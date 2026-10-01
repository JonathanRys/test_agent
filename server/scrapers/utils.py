"""
Shared toolkit for the per-state park scrapers in scrapers/stateParks/.

Every state scraper (alabama.py, alaska.py, ...) is a small CONFIG dict plus
optional parse hooks; this module owns everything they have in common:

* HTTP        - retrying requests sessions, a per-state page cache under
                .cache/<state>.json with a 30 day TTL, and navigation-stripped
                text extraction so site wide menus do not leak into detections.
* Paging      - a list index is a single page by default. A state whose park or
                campground list is paginated sets CONFIG["list_page_limit"] and
                the pager's own links ("?page=N", rel=next) are followed and
                merged, so no unit is lost after page one.
* Detectors   - reservation / permit / activity keyword detection ported from
                stateParksScraper so every state uses the exact same rules.
* Fees        - entry-fee-only age-range tiers via fee_windows() and
                parse_entry_fee(): age tiers first, then the first amount whose
                own clause describes admission (never boat launch/camping/etc.),
                then the shared free-text detector as a last resort.
* Activities  - activities table ids resolved from the app's memory.db (child id
                wins for duplicate names) with a seeder-identical fallback derived
                from data/activities.json. Activities a page mentions that have no
                table row are reported in data/untrackedActivities.json, which is
                only written when there is something to report.
* Boundaries  - optional geoJSON: park page links matching a boundary pattern
                (.geojson / .kml / ArcGIS FeatureServer|MapServer) are resolved;
                downloadable GeoJSON is stored under data/stateParks/geo/<abbr>/ and
                the record's "boundary" field points at it (relative to
                data/stateParks/). States may also set
                CONFIG["boundary_service"] to an ArcGIS layer URL queried per
                park name.

Scraper CONFIG schema (all keys optional except state/abbr/list_url):

    CONFIG = {
        "state": "Alabama",                  # states.json name (for stateId)
        "abbr": "AL",                        # states.json abbreviation
        "list_url": "https://.../parks",     # the page that lists every park
        "park_path_pattern": r"^/parks/[^/]+/?$",  # hrefs that are park pages
        "list_page_limit": 3,                # 1 (default) = first page only
        "container": "main",                 # CSS selector scoping the link search
        "link_selector": "div.cards a",      # optional precise anchor selector
        "name_from": "slug",                 # "slug" or callable(text, href)
        "ignore_text": {"view all"},         # extra generic anchor labels to skip
        "parse_list": callable,              # override list parsing entirely
        "campground_list_url": "https://.../campgrounds",   # campground index page
        "campground_path_pattern": r"^/camp/[^/]+/?$",      # defaults to park_path_pattern
        "campground_parse_list": callable,   # override campground index parsing
        "campgrounds_shared_with_parks": False,  # index repeats the park pages
        "campground_pattern": r"(?i)campground",           # or match "<name> <link>"
        "boundary_pattern": re.Pattern,      # override boundary link detection
        "boundary_service": "https://.../FeatureServer/0",  # ArcGIS layer for all parks
    }

Output files
------------
A state always writes data/stateParks/<state>Parks.json. Campgrounds are split
into data/stateParks/<state>_campgrounds.json, with "siteFee" in place of
"entryFee" (a campground charge is a site fee). They come from two sources, both
optional:
* CONFIG["campground_list_url"] - a dedicated campground index page. A unit on
  both lists is a campground and leaves the parks file (Alaska), unless
  CONFIG["campgrounds_shared_with_parks"] records that the index repeats the park
  pages instead of listing separate campgrounds (Arkansas): then both files keep
  the unit and the index only adds the campground records.
* campground links found on the park pages themselves, which is how most
  agencies publish camping (a park page links its own campground page). Set
  CONFIG["campground_links"] = False to turn the second source off, or
  CONFIG["campground_link_pattern"] to narrow which links count.

Usage (from a state scraper):

    import utils
    CONFIG = {...}
    def main():
        utils.run(CONFIG)
"""

import argparse
import json
import os
import re
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# Paths and constants
# ---------------------------------------------------------------------------

SCRAPERS_DIR = os.path.abspath(os.path.dirname(__file__))
# server/data holds the app's shared data files (states.json, activities.json and
# the shared untrackedActivities.json backlog).
DATA_DIR = os.path.abspath(os.path.join(SCRAPERS_DIR, "../data"))
# Everything the park scrapers write lives in server/data/stateParks/: one
# <state>Parks.json per state, the legacy combined stateParks.json, and the geo/
# boundary files the records point at.
OUTPUT_DIR = os.path.join(DATA_DIR, "stateParks")
STATES_FILE = os.path.join(DATA_DIR, "states.json")
ACTIVITIES_FILE = os.path.join(DATA_DIR, "activities.json")
# Every state scraper merges its untracked activities into this one file.
UNTRACKED_FILE = os.path.join(DATA_DIR, "untrackedActivities.json")
UNTRACKED_LOCK = UNTRACKED_FILE + ".lock"
GEO_DIR = os.path.join(OUTPUT_DIR, "geo")
CACHE_DIR = os.path.join(SCRAPERS_DIR, ".cache")

# The activities table is seeded into the app's SQLite database from
# data/activities.json, so ids follow that file's row order (rows named "Empty"
# are skipped). Hiking, Biking and Offroading each exist as a parent row and a
# child row; the child id wins in load_activity_ids(), matching the id the
# client already uses for Hiking (7).
# The app's SQLite database (server/utils/db.ts and server/config/config.json both
# resolve "../../data/memory.db" from the server package, which is this file).
# It is only ever opened read-only; if it is missing the ids are derived from
# data/activities.json instead.
ACTIVITY_DB = os.path.abspath(os.path.join(SCRAPERS_DIR, "../../data/memory.db"))

# State agency sites are served by a mixed bag of WAFs, so present a normal
# browser profile.
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 25
MAX_WORKERS = 6
CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
CACHE_TEXT_LIMIT = 20000
CACHE_LINK_LIMIT = 300
# Bump when the campground link rules change, so cached pages are refreshed once
# instead of serving links mined by an older rule.
CAMPGROUND_LINKS_VERSION = 6
# Images, PDFs and other assets are never campground pages.
MEDIA_SUFFIX_PATTERN = re.compile(
    r"(?i)\.(?:jpe?g|png|gif|webp|svg|pdf|mp4|mov|zip|kmz|kml|geojson|csv|xlsx?)$"
)

# List index pagers number their pages in the query string; Drupal's "?page=0" is
# the first page, Squarespace's "?p=1" also starts at one, so the number is read
# as-is and only pages after the first are followed.
PAGER_PAGE_PATTERN = re.compile(r"(?i)(?:^|[?&])(?:page|p)=(?P<page>\d+)")

# ---------------------------------------------------------------------------
# Activity keywords (keys must exist in data/activities.json)
# ---------------------------------------------------------------------------

ACTIVITY_KEYWORDS = {
    "Hiking": r"\bhik(?:e|es|ed|ing|er|ers)\b|hiking trails?\b",
    "Walking": r"\bwalk(?:s|ed|ing)\b|nature walk|\bboardwalk\b|\bpromenade\b",
    "Backpacking": r"\bbackpack(?:ing|er|ers)?\b|backcountry camping\b",
    "Mountaineering": r"\bmountaineering\b|\balpine climbing\b|\brock climbing\b|\btechnical climbing\b",
    "Running": r"\brunning\b|\bjogging\b|\b5k\b|\bmarathon\b",
    "Trail Running": r"\btrail running\b|\btrail race\b",
    "Biking": r"\bbicycl(?:e|es|ing|ists?)\b|\bcycling\b|\bbike path\b|\bbike trail\b|\bbike riding\b",
    "Bikepacking": r"\bbikepacking\b",
    "Mountain Biking": r"\bmountain bik(?:e|es|ing|ers?)\b|\bsingle[- ]?track\b",
    "Road Biking": r"\broad (?:bik(?:e|es|ing)|cycling)\b",
    "Offroading": r"\boff[- ]road(?:ing)?\b|\boff[- ]road driving\b|\boff[- ]road vehicle",
    "4x4": r"\b4x4\b|\bfour[- ]wheel drive\b|\bjeep trail\b",
    "ATV": r"\batv\b|\ball[- ]terrain vehicles?\b|\butv\b|\bohv\b|\boff[- ]highway vehicle",
    "Dirt Biking": r"\bdirt bik(?:e|es|ing)\b|\bmotocross\b|\benduro\b",
    "Motorcycling": r"\bmotorcycl(?:e|es|ing|ists?)\b",
    "Over-landing": r"\bover[- ]?landing\b",
    "Downhill Skiing": r"\bdownhill[\s-]?ski(?:ing)?\b|\balpine[\s-]?ski(?:ing)?\b",
    "Cross-country Skiing": r"\bcross[\s-]?country[\s-]?ski(?:ing)?\b|\bnordic[\s-]?ski(?:ing)?\b|\bxc[\s-]?ski(?:ing)?\b",
    "Snowboarding": r"\bsnowboard(?:s|ing|ers?)?\b",
    "Skate Skiing": r"\bskate[\s-]?ski(?:ing)?\b",
    "Snowshoeing": r"\bsnowsho(?:e|es|eing|ing)\b",
    "Snowmobiling": r"\bsnowmobil(?:e|es|ing|ers?)\b",
    "Kayaking": r"\bkayak(?:s|ing|ers?)?\b",
    "Canoeing": r"\bcanoe(?:s|ing|ists?)?\b",
    "Whitewater Rafting": r"\bwhite[- ]?water\b|\brafting\b|\braft trips?\b",
    "Horseback Riding": r"\bhorseback (?:riding|trails?)\b|\bequestrian\b|\bhorse trails?\b",
    # Activities added to data/activities.json (they used to be reported as
    # untracked). "Golf" skips mini/disc golf, which have their own rows.
    "Camping": r"\bcamp(?:ing|grounds?|sites?)\b",
    "Fishing": r"\bfish(?:ing|er|ers)?\b",
    "Swimming": r"\bswim(?:ming|mer|bers?)?\b",
    "Golf": r"(?<!mini )(?<!miniature )(?<!disc )\bgolf\b",
    "Mini Golf": r"\bmini(?:ature)? golf\b",
    "Disc Golf": r"\bdisc golf\b",
    "Archery": r"\barcher(?:y|ies)\b",
    "Tennis": r"\btennis\b",
    "Pickleball": r"\bpickleball\b",
    "Geocaching": r"\bgeo-?cach(?:es|ing|ers?)?\b",
    "Birding": r"\bbird(?:ing|watching|ers?)\b",
    "Hunting": r"\bhunt(?:ing|ers?)\b",
    "Sailing": r"\bsail(?:ing|boats?|or)?\b",
    "Paddleboarding": r"\bpaddle[\s-]?board(?:s|ing|er|ers)?\b",
    "Waterskiing": r"\bwater[\s-]?ski(?:ing|ers?|ed)?\b",
    "Tubing": r"\btubing\b|snow tubes?",
    "Zip Lining": r"\bziplin(?:e|es|ing)\b|\bzip[\s-]?lining\b|\bzip[\s-]?lines?\b",
    "Ropes Course": r"\bropes? course\b",
}
ACTIVITY_PATTERNS = {name: re.compile(pattern, re.IGNORECASE) for name, pattern in ACTIVITY_KEYWORDS.items()}

# ---------------------------------------------------------------------------
# Reservation / permit / fee detection
# ---------------------------------------------------------------------------

# Booking systems used by nearly every state park agency.
RESERVATION_LINK_PATTERN = re.compile(
    r"(reserveamerica\.com|recreation\.gov|reservecalifornia\.com|reservations?\.\w+\.(?:gov|com)|"
    r"floridastateparks\.com/camping|tentrr|hipcamp)",
    re.IGNORECASE,
)
RESERVATION_TEXT_PATTERN = re.compile(
    r"\breservations?\b|\breserve (?:a )?(?:campsite|cabin|site|online)\b|"
    r"\bbook (?:a )?(?:campsite|cabin|site|camping)\b|\breservation system\b",
    re.IGNORECASE,
)

ENTRY_FEE_PATTERN = re.compile(
    r"(entrance fee|entrance fees|day[- ]use fee|admission fee|admission is|park fee|user fee|vehicle fee|"
    r"parking fee|entrance pass|day pass|per vehicle|per person|per adult|per child)",
    re.IGNORECASE,
)

PERMIT_PATTERN = re.compile(
    r"\bpermit(?:s)? (?:is |are )?(?:required|needed|mandatory)\b|\brequires? a permit\b|"
    r"\bpermit required\b|\bspecial use permit\b",
    re.IGNORECASE,
)

FEE_AMOUNT_PATTERN = re.compile(r"\$\s?\d{1,3}(?:\.\d{2})?(?:\s*(?:per|each|a)\s+[a-z]+|/\s*[a-z]+)?", re.IGNORECASE)
FREE_PATTERN = re.compile(r"\bfree\b", re.IGNORECASE)

# Fee headings delimit the text slices scanned for age tiers; each slice stops at the next
# heading, at an annual-pass mention (passes are not entry fees) or after 300 characters.
FEE_ANCHOR_PATTERN = re.compile(
    r"gate entrance fees|entrance fees|park entrance fee|entrance fee|entry fee|"
    r"park admission fee|admission fee|day[- ]use fees|park entry fee|gate fee|fees",
    re.IGNORECASE,
)
ANNUAL_PATTERN = re.compile(r"\bannual\b", re.IGNORECASE)
# Sub-headers such as "Cave Tours (Includes Entrance Fee):" end the entrance fee tier list.
# Parenthesized age ranges ("Adult (14+):", "Youth (7-13):") are tiers, not sub-headers,
# so the stopper only fires when the parens hold letters and no digits.
FEE_SUBCATEGORY_PATTERN = re.compile(r"\([^)\d]*[A-Za-z][^)\d]*\)\s*:")

# Age tiers as written on park pages: "Ages 4-11, $3.00", "Age 6 to 12: $2",
# "Ages 62+", "Age 62 and over: $2", "12 and up - $3.00", "Ages 3 and under are free",
# plus parenthesized and label-led forms such as "Adult (14+)", "Youth (7-13)",
# "Child (0-6)" and "Adult 14+".
AGE_TIER_PATTERN = re.compile(
    r"(?:ages?|kids?)\s*(\d+)\s*(?:[-\u2013]|\s+to\s+|\s*-\s*)\s*(\d+)"  # range -> "4-11"
    r"|(?:ages?|kids?)\s*(\d+)\s*(?:\+|\s*and\s+(?:up|over))"  # open end -> "62+"
    r"|(\d+)\s+and\s+(?:up|over)"  # bare -> "12+"
    r"|(?:ages?|kids?)\s*(\d+)\s+and\s+under"  # under -> "3 and under"
    r"|\(\s*(\d+)\s*(?:[-\u2013]|\s+to\s+)\s*(\d+)\s*\)"  # parenthesized range -> "(7-13)"
    r"|\(\s*(\d+)\s*\+\s*\)"  # parenthesized open end -> "(14+)"
    r"|(?:adults?|youth|child|children|juniors?|teens?|seniors?)\s*\(?(\d+)\s*(?:[-\u2013]|\s+to\s+)\s*(\d+)\)?"  # labeled range -> "Youth 7-13"
    r"|(?:adults?|youth|child|children|juniors?|teens?|seniors?)\s*\(?(\d+)\s*\+\)?",  # labeled open end -> "Adult 14+"
    re.IGNORECASE,
)
# Non-age admission modes priced alongside the tiers, e.g. "Individual/walk-in: $5.00".
MODE_TIER_PATTERN = re.compile(
    r"(individual\s*/\s*walk[-\s]*in|walk[-\s]*in)\b",
    re.IGNORECASE,
)
TIER_FEE_PATTERN = re.compile(r"\$\s?\d{1,3}(?:\.\d{1,2})?|\bfree\b", re.IGNORECASE)

# Fallback for fee text without age tiers: keep only the first amount whose context
# describes admission, ignoring amounts priced for other things (boat launches, camping).
ENTRY_CONTEXT_PATTERN = re.compile(
    r"entrance|entry|admission|gate fee|day[- ]use|to enter|per vehicle|per person",
    re.IGNORECASE,
)
NON_ENTRY_CONTEXT_PATTERN = re.compile(
    r"boat launch|launch fee|boat ramp|camping|campground|campsite|nightly|per night|"
    r"overnight|rental|cabin|pavilion|group (?:site|use|fee)|dump station",
    re.IGNORECASE,
)
FALLBACK_FEE_PATTERN = re.compile(
    r"\$\s?\d{1,3}(?:\.\d{1,2})?(?:\s+per\s+\w+)?|\bfree\b", re.IGNORECASE
)

# Site chrome (menus, headers, footers) repeats across every park page of an agency, so it is
# removed before keyword detection. Sidebars are kept because agencies often keep hours and
# entrance fees there.
NAVIGATION_HINT = re.compile(
    r"(^|[-_])(menu|navbar|mega|breadcrumb|tabs?|header|footer|social|drawer|offcanvas)([-_]|$)",
    re.IGNORECASE,
)

# Recreation activities that show up on park pages but have no row in the
# activities table. data/activities.json now covers everything the scrapers
# used to report here (camping, fishing, swimming, golf, tennis, archery,
# pickleball, birding, hunting, sailing, waterskiing, tubing, zip lining, ...),
# so this list is empty and kept only as the place to add the next gap that
# shows up on agency pages. Anything detected with no table id is still
# reported to data/untrackedActivities.json.
UNTRACKED_ACTIVITY_CANDIDATES = {}
UNTRACKED_ACTIVITY_PATTERNS = {
    name: re.compile(pattern, re.IGNORECASE) for name, pattern in UNTRACKED_ACTIVITY_CANDIDATES.items()
}

# Anchor labels too generic to name a park.
GENERIC_LINK_TEXT = {
    "park", "parks", "view", "view all", "see all", "learn more", "more", "details",
    "detail", "read more", "click here", "home", "website", "link",
}

# Campground pages reached from a park page: a "camp..." path segment either with
# children (/camping/<park>/...) or in final position (<park>/campsites). Kept in the
# page cache alongside the park page's text so the campground pass can reuse it.
# Link labels that are navigation or policy pages, not a campground itself.
CAMPGROUND_STOPLIST = {
    "index", "reservations", "reservation", "reserve", "book", "booking", "availability",
    "policies", "policy", "fees", "fee", "information", "info", "contact", "search",
    "faq", "faqs", "rules", "regulations", "map", "maps", "photos", "photo", "video",
    "news", "blog", "contact-us", "camping", "campgrounds", "campground", "camp",
    "find-a-campground", "find-campground", "campground-search", "things-to-do",
    "camping-reservations", "campground-reservations", "reservations-policies",
    "group-camping", "rv-park", "rvparks", "cabins", "lodging", "permits", "passes",
    "campground-hosts", "campground-host", "hosts", "camping-home", "campinghome",
    "camping-activities", "campground-availability", "campground-conditions",
    "make-a-reservation", "reserve-now", "reserve-campsite", "campsites-reservation",
}

# A path segment is a campground page when it names the thing itself.
CAMPGROUND_NOUN_PATTERN = re.compile(
    r"(?i)(campground|campgrounds|campsite|campsites|camp-site|camp-sites|camping|"
    r"rv-park|rv-parks|caravan|tent-site|tent-sites)"
)
# ...and not a policy/program/booking/news page that happens to sit under a campground.
# Path level: a hub, form or blog page. "fee" is deliberately absent because agencies
# park campground pages under paths like /state-parks/x/fees-facilities/campsites.
CAMPGROUND_PATH_JUNK_PATTERN = re.compile(
    r"(?i)(condition|permit|policy|polic|rules|regulation|galler|photo|video|vendor|"
    r"host|availab|reserv|book|price|pricing|map|guide|brochure|faq|contact|"
    r"hour|accessib|direction|things|activit|news|event|program|staff|purchase|"
    r"gift|pass|wifi|pet|boat|fish|hike|swim|playground|shelter|picnic|group|"
    r"improv|renovat|register|store|volunteer|first-come|waterfront|update|closure|"
    r"construction|maintenance|blog|post|media|press|webform|key-location|"
    r"backcountry|inspiration|best|with)"
)
# Final segment only: a money/booking/media word means that page is not the campground.
CAMPGROUND_SEGMENT_JUNK_PATTERN = re.compile(
    r"(?i)(fee|price|pricing|reserv|book|availab|vendor|host|photo|video|galler|detail|"
    r"condition|permit|policy|polic|rules|regulation|closure|construction|maintenance|"
    r"improv|renovat|register|store|volunteer|first-come|waterfront|update|blog|post|"
    r"media|press|webform|key-location|backcountry|inspiration|best|with|hours|contact|"
    r"faq|map|guide|brochure|direction|accessib|wifi|pet|picnic|shelter|playground|"
    r"group|boat|fish|hike|swim|pass|gift|staff|program|event|news|things|activit)"
)
# Link text that is navigation rather than a campground name.
NAV_TEXT_PATTERN = re.compile(
    r"(?i)(^|\b)(view|see|read|more|all|here|go|learn|explore|find|check|download|get|"
    r"show|return|back|top|menu|close|next|previous)([^a-z]|$)|»|>|conditions?|gallery|"
    r"policies|permit|reservation|hours|directions|map|photo|video|news|event|vendors?|"
    r"programs?$|^camp(ing|grounds?|sites?)$|\bcampsites?\b"
)

# Default href shapes that point at boundary geodata (state specific configs may
# pass a narrower pattern via CONFIG["boundary_pattern"]).
BOUNDARY_SUFFIX_PATTERN = re.compile(r"\.(?:geojson|kml|kmz)(?:\?|#|$)", re.IGNORECASE)
BOUNDARY_ARCGIS_PATTERN = re.compile(r"(?:feature|map)server(?:/\d+)?(?:/query)?(?:\?|$)", re.IGNORECASE)
BOUNDARY_GIS_HINT_PATTERN = re.compile(r"/(?:gis|geo|geodata|boundaries)(?:/|[^/]*\.json)", re.IGNORECASE)

# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------

SESSION_LOCAL = threading.local()


def build_http_session(headers):
    """
    Builds a requests session with retries for flaky agency sites.
    """
    session = requests.Session()
    session.headers.update(headers)
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_maxsize=MAX_WORKERS)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def get_session(headers):
    """
    Returns a thread local session for a header profile so parallel workers do not
    share a connection pool.
    """
    sessions = getattr(SESSION_LOCAL, "sessions", None)
    if sessions is None:
        sessions = {}
        SESSION_LOCAL.sessions = sessions

    key = tuple(sorted(headers.items()))
    if key not in sessions:
        sessions[key] = build_http_session(headers)
    return sessions[key]


def fetch(url, headers=None, extra_headers=None):
    """
    Performs a GET request and returns the response, or None when the site refuses
    to cooperate (blocked, DNS failure, timeout, ...).
    """
    try:
        response = get_session(headers or BROWSER_HEADERS).get(
            url,
            headers=extra_headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        print(f"    ! request failed for {url}: {type(exc).__name__}")
        return None


def fetch_soup(url, headers=None):
    """
    Fetches a page and returns it as a BeautifulSoup document, or None on failure.
    """
    response = fetch(url, headers=headers)
    if response is None:
        return None
    return BeautifulSoup(response.text, "html.parser")


# ---------------------------------------------------------------------------
# Per-state page cache
# ---------------------------------------------------------------------------


def cache_file(state_slug):
    """
    Returns the cache file used by one state scraper. Keeping caches per state
    stops a single JSON file from being rewritten in full after every state run.
    """
    return os.path.join(CACHE_DIR, f"{state_slug}.json")


def load_cache(state_slug):
    """
    Loads the page cache that keeps repeat runs from re-fetching an agency site.
    """
    path = cache_file(state_slug)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return {}


def save_cache(cache, state_slug):
    """
    Persists the page cache atomically so an interrupted run cannot corrupt it.
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = cache_file(state_slug)
    temp_file = f"{path}.tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(dict(cache), f, ensure_ascii=False)
    os.replace(temp_file, path)


# ---------------------------------------------------------------------------
# Local data files
# ---------------------------------------------------------------------------


def load_states():
    """
    Loads states.json and returns {state name: 1-based stateId} and
    {abbreviation: state name}.
    """
    with open(STATES_FILE, "r", encoding="utf-8") as f:
        states_data = json.load(f)

    by_name = {}
    by_abbreviation = {}
    for index, state in enumerate(states_data, start=1):
        by_name[state["name"]] = index
        by_abbreviation[state["abbreviation"].upper()] = state["name"]
    return by_name, by_abbreviation


def load_state_id(abbr):
    """
    Returns the 1-based database id for a state abbreviation from data/states.json
    (the states table auto-increment IDs match the states.json order).
    """
    by_name, by_abbreviation = load_states()
    return by_name[by_abbreviation[abbr.upper()]]


def load_activity_ids():
    """
    Returns {"<activity name>": <activities table id>} for the app database
    (data/memory.db, opened read-only). When a name appears twice (a parent row
    and its child row) the higher id wins, so "Hiking" maps to the child row.
    Falls back to the ids the seeder would derive from data/activities.json when
    no database is available.
    """
    if os.path.exists(ACTIVITY_DB):
        try:
            connection = sqlite3.connect(f"file:{ACTIVITY_DB}?mode=ro", uri=True)
            rows = connection.execute("SELECT id, name FROM activities ORDER BY id").fetchall()
            connection.close()
        except sqlite3.Error:
            rows = []
        if rows:
            return {name: activity_id for activity_id, name in rows}

    # No seeded database, so derive the ids the seeder would produce from
    # data/activities.json: rows named "Empty" are skipped, an explicit "id" is
    # honoured, and rows without one continue SQLite's AUTOINCREMENT (the
    # highest id inserted so far + 1), so the mapping matches a seeded table.
    with open(ACTIVITIES_FILE, "r", encoding="utf-8") as f:
        rows = json.load(f)

    activity_ids = {}
    last_id = 0
    for row in rows:
        name = row.get("name")
        if not name or name == "Empty":
            continue
        row_id = int(row["id"]) if row.get("id") is not None else last_id + 1
        last_id = max(last_id, row_id)
        # Later rows overwrite earlier ones, so a name that exists as both a
        # parent and a child maps to the child row (e.g. Hiking -> 12).
        activity_ids[name] = row_id
    return activity_ids


# ---------------------------------------------------------------------------
# Page fetching and text extraction
# ---------------------------------------------------------------------------


def strip_navigation(soup):
    """
    Removes scripts and site chrome (menus, headers, footers) so keyword detection
    only sees the page content. Sidebars are kept because agencies often keep
    fees and hours there.
    """
    for junk in soup.find_all(["script", "style", "noscript", "nav", "header", "footer", "aside"]):
        junk.decompose()

    for element in list(soup.find_all(True)):
        if element.parent is None:
            continue
        classes = " ".join(element.get("class") or [])
        element_id = element.get("id") or ""
        if NAVIGATION_HINT.search(classes) or NAVIGATION_HINT.search(element_id):
            element.decompose()
    return soup


def is_campground_link(href, park_link, base_url, config=None):
    """
    True when a link found on a park page looks like a campground page rather than a
    camping policy, program or reservation-landing page.

    Two shapes are accepted:
      /camping/<park>/...            a campground section with its own children
      /state-parks/<park>/campsites a park's campground section at the end
    """
    if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
        return False
    absolute = urljoin(base_url, href)
    if absolute.rstrip("/") == (park_link or "").rstrip("/"):
        return False
    if MEDIA_SUFFIX_PATTERN.search(urlparse(absolute).path) or "/wp-content/" in absolute.lower():
        return False
    parsed = urlparse(absolute)
    # Stay on the agency's own site; campground pages on a reservation platform are
    # somebody else's pages.
    if urlparse(park_link or base_url).netloc.split(".")[-2:] != parsed.netloc.split(".")[-2:]:
        return False

    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 2:
        return False
    last = segments[-1].lower()
    # The last segment has to name the campground itself ("campsites",
    # "boyd-hill-campground", "campgroundDetails.do"), not a policy or program page
    # that happens to live under a campground.
    if not CAMPGROUND_NOUN_PATTERN.search(last):
        return False
    # Junk anywhere in the path: /dnr/things-to-do/camping-and-lodging/state-forest-campgrounds
    # and /webform/register-backcountry-camp-x are hubs and forms, not campgrounds.
    if CAMPGROUND_PATH_JUNK_PATTERN.search(parsed.path):
        return False
    if CAMPGROUND_SEGMENT_JUNK_PATTERN.search(last) or last in CAMPGROUND_STOPLIST:
        return False
    # A bare "/camping" or "/campgrounds" segment is a finder page unless the park's
    # own page sits above it (/roper-lake/camping-and-cabins/campsites).
    if len(segments) < 3 and last in ("campground", "campgrounds", "campsite", "campsites",
                                     "camp-sites", "camping", "rv-park", "rv-parks"):
        return False

    pattern = (config or {}).get("campground_link_pattern")
    if pattern is not None:
        if isinstance(pattern, str):
            pattern = re.compile(pattern)
        return bool(pattern.search(parsed.path))
    return True


# Slugs like ".../primitive-campsites" or ".../wall-tent-campsite" name a camping
# type rather than a campground, so the name is composed from the park plus the type.
CAMPGROUND_TYPE_WORDS = {
    "primitive", "backpacking", "wall-tent", "wall", "tent", "group", "equestrian",
    "walk-in", "boat-in", "drive-in", "backcountry", "dispersed", "remote", "standard",
    "rv", "yurt", "cabin", "boat", "hiker", "biker", "horse",
}


def campground_name_from(text, href, park_name=None):
    """
    A usable name for a mined campground link: the link text when it reads like a
    name, otherwise the most specific slug in the path turned into words
    ("/camping/makoshika-state-park/r/campgroundDetails.do" -> "Makoshika State Park").
    When that resolves to the park it belongs to, "Campground" is appended so the
    campground file never just repeats a park name.
    """
    text = clean_park_name(text)
    if (
        text
        and 3 < len(text) < 80
        and len(text.split()) <= 8          # a sentence, not a name
        and not text.endswith(".")
        and not re.search(r"(?i)\bcamping\b", text)   # "Primitive Camping" is a type
        and text.casefold() not in CAMPGROUND_STOPLIST
        and not NAV_TEXT_PATTERN.search(text)
        and not CAMPGROUND_SEGMENT_JUNK_PATTERN.search(text)
    ):
        # Link text that is just the park's own name still needs the campground suffix.
        if park_name and text.casefold() == clean_park_name(park_name).casefold():
            return f"{text} Campground"
        return text

    park = clean_park_name(park_name) if park_name else ""
    segments = [segment for segment in urlparse(href).path.split("/") if segment]
    for raw_segment in reversed(segments):
        segment = re.sub(r"(?i)\.(?:do|html?|aspx?|php)$", "", raw_segment)
        lowered = segment.lower()
        if (len(segment) < 4 or lowered in CAMPGROUND_STOPLIST
                or CAMPGROUND_SEGMENT_JUNK_PATTERN.search(lowered) or re.search(r"(?i)details?$", lowered)):
            continue
        if CAMPGROUND_NOUN_PATTERN.search(lowered):
            # A slug that carries the campground name, e.g. "boyd-hill-campsites".
            stripped = re.sub(
                r"(?i)[-_.]?(campgrounds?|camp-sites?|campsites?|rv-parks?|tent-sites?|caravan-sites?)$",
                "", segment,
            )
            name = slug_to_name(stripped) if stripped else ""
            if not name:
                # A generic segment ("campsites"): the campground is named after the
                # park it belongs to.
                return f"{park} Campground" if park else slug_to_name(href)
            if park and name.casefold() == park.casefold():
                return f"{name} Campground"
            if re.search(r"(?i)\b(and|or|the|for|at|on)$", name) or len(name) < 3:
                return f"{park} Campground" if park else name
            if name.casefold().split()[-1] in CAMPGROUND_TYPE_WORDS or all(
                word in CAMPGROUND_TYPE_WORDS for word in name.casefold().split()
            ):
                # A camping type, not a place: "Desoto State Park Primitive Campsites".
                return f"{park} {name} Campsites" if park else f"{name} Campsites"
            return name
        if lowered.startswith("camp"):
            continue
        name = slug_to_name(segment)
        if name:
            if park and name.casefold() == park.casefold():
                return f"{name} Campground"
            return name
    if park:
        return f"{park} Campground"
    return slug_to_name(href)


def is_campground_name(name):
    """
    Last gate before a mined link becomes a record: the name has to read like a
    campground, not a camping section or a promo line. Names that are just a
    camping type ("Primitive campgrounds", "Winter Camping") or that mix in
    section words ("Lodging and Camping") are rejected.
    """
    if not name or len(name) > 90:
        return False
    if re.search(r"(?i)\b(camping|lodging|adventures|seasonal|winter|summer|spring|autumn|"
                 r"fall|football|basketball|tournaments?|festivals?|educational|programs?)\b", name):
        return False
    if re.search(r"(?i)\b(and|or|the|for|at|on)$", name):
        return False
    if re.fullmatch(r"(?i)\s*(state\s+)?parks?\s*", name):
        return False
    # "<type> campgrounds" is a category heading, e.g. "Primitive campgrounds".
    words = [word.casefold() for word in name.split()]
    if words and words[-1] in ("campground", "campgrounds", "campsite", "campsites"):
        head = [word for word in words[:-1] if word]
        if head and all(word in CAMPGROUND_TYPE_WORDS for word in head):
            return False
    return True


def is_boundary_href(href, config=None):
    """
    Returns True when an href plausibly points at boundary geodata: a .geojson/
    .kml/.kmz file, an ArcGIS FeatureServer/MapServer layer, or a path with an
    explicit GIS hint. CONFIG["boundary_pattern"] narrows this per state.
    """
    if not href:
        return False
    pattern = (config or {}).get("boundary_pattern")
    if pattern is not None:
        if isinstance(pattern, str):
            pattern = re.compile(pattern)
        return bool(pattern.search(href))
    return bool(
        BOUNDARY_SUFFIX_PATTERN.search(href)
        or BOUNDARY_ARCGIS_PATTERN.search(href)
        or (BOUNDARY_GIS_HINT_PATTERN.search(href) and href.lower().endswith((".json", ".geojson")))
    )


def fetch_page(url, cache, config=None):
    """
    Fetches a page once and returns a cache entry with navigation-stripped text,
    reservation links and boundary-geodata links. The caller owns cache writes so
    worker threads never mutate the shared cache while it is being serialized.
    Failures are not cached so a later run can retry them.
    """
    cached = cache.get(url)
    # An entry cached before campground links were collected is re-fetched once so
    # the campground pass has something to mine.
    if (
        cached
        and cached.get("campgroundLinksVersion") == CAMPGROUND_LINKS_VERSION
        and time.time() - cached.get("fetchedAt", 0) < CACHE_TTL_SECONDS
    ):
        return cached

    entry = {"status": None, "text": "", "reservationLinks": [], "boundaryLinks": [],
             "campgroundLinks": [], "fetchedAt": 0}
    response = fetch(url)
    if response is not None:
        soup = strip_navigation(BeautifulSoup(response.text, "html.parser"))
        anchors = soup.find_all("a", href=True)
        hrefs = [anchor["href"] for anchor in anchors]
        campground_links = []
        seen_campground = set()
        for anchor in anchors:
            if not is_campground_link(anchor["href"], url, url, config):
                continue
            link = urljoin(url, anchor["href"])
            if link in seen_campground:
                continue
            seen_campground.add(link)
            campground_links.append([link, anchor.get_text(" ", strip=True)])
        entry = {
            "status": response.status_code,
            "text": soup.get_text(" ", strip=True)[:CACHE_TEXT_LIMIT],
            "reservationLinks": [href for href in hrefs if RESERVATION_LINK_PATTERN.search(href)][:5],
            "boundaryLinks": list(
                dict.fromkeys(href for href in hrefs if is_boundary_href(href, config))
            )[:CACHE_LINK_LIMIT],
            "campgroundLinks": campground_links[:CACHE_LINK_LIMIT],
            "campgroundLinksVersion": CAMPGROUND_LINKS_VERSION,
            "fetchedAt": time.time(),
        }
    return entry


def fetch_list_html(url, cache):
    """
    Fetches the park list page and returns its cache entry {"status", "html",
    "fetchedAt"}. The caller writes the entry into the cache so this stays
    side-effect free. Failures are not cached so a later run can retry them.
    """
    cached = cache.get(url)
    if cached and time.time() - cached.get("fetchedAt", 0) < CACHE_TTL_SECONDS and cached.get("html"):
        return cached

    entry = {"status": None, "html": None, "fetchedAt": 0}
    response = fetch(url)
    if response is not None:
        entry = {"status": response.status_code, "html": response.text, "fetchedAt": time.time()}
    return entry


def pager_page_urls(soup, url):
    """
    Returns a list index's own pager links (page 2 and up) in page order.

    Only links that stay on the same host and path as `url` count, so site menus
    and "you may also like" blocks cannot drag the scraper onto other pages. The
    page number is read from the pager's query links (Drupal and Squarespace both
    number page one "?page=0" / "?p=0"); a pager that only publishes rel=next
    links is followed through those. Links back to the page being read - including
    the "#main-content" variants a pager uses for its current page - are dropped.
    """
    base = urlparse(url)
    current = base._replace(fragment="").geturl()
    numbered = {}
    next_url = None
    for anchor in soup.find_all("a", href=True):
        parsed = urlparse(urljoin(url, anchor["href"].strip()))
        if parsed.netloc != base.netloc or parsed.path.rstrip("/") != base.path.rstrip("/"):
            continue
        target = parsed._replace(fragment="").geturl()
        if target == current:
            continue
        match = PAGER_PAGE_PATTERN.search(parsed.query)
        if match:
            # Page numbers are absolute, and the same page is often linked twice
            # (as "next" and as "last"), so the first link for a number wins.
            if int(match.group("page")) > 0:
                numbered.setdefault(int(match.group("page")), target)
            continue
        if next_url is None and "next" in (anchor.get("rel") or []):
            next_url = target
    pages = [numbered[page] for page in sorted(numbered)]
    if not pages and next_url:
        pages.append(next_url)
    return pages


def collect_list_html(url, config, cache):
    """
    Fetches a list index and (when CONFIG["list_page_limit"] allows) the pager
    pages it links, returning [(url, entry)] in page order.

    Cache writes happen here so the park list and the campground list share one
    pagination rule. fetch_list_html never caches failures, so a blocked or
    unreachable page is retried by the next run.
    """
    limit = max(1, int(config.get("list_page_limit") or 1))
    pages = []
    seen = set()
    queue = [url]
    while queue and len(pages) < limit:
        page_url = queue.pop(0)
        if page_url in seen:
            continue
        seen.add(page_url)
        entry = fetch_list_html(page_url, cache)
        cache[page_url] = entry
        pages.append((page_url, entry))
        if entry.get("status") != 200 or not entry.get("html"):
            continue
        queue.extend(pager_page_urls(BeautifulSoup(entry["html"], "html.parser"), page_url))
    return pages


def dedupe_records(records):
    """
    Keeps the first record per link, preserving order. Pager pages repeat whatever
    a site pins to the top of every page, so merged pages need the same
    deduplication parse_list_page does inside one page.
    """
    unique = []
    seen = set()
    for record in records:
        if record["link"] in seen:
            continue
        seen.add(record["link"])
        unique.append(record)
    return unique


# ---------------------------------------------------------------------------
# Detectors (identical rules for every state)
# ---------------------------------------------------------------------------


def detect_activities(*texts):
    """
    Maps free text onto the activity names used by data/activities.json.
    """
    combined = " ".join(text for text in texts if text)
    if not combined:
        return []
    return sorted(name for name, pattern in ACTIVITY_PATTERNS.items() if pattern.search(combined))


def detect_entry_fee(text):
    """
    Extracts a short, best effort entrance fee description ("$5 per vehicle")
    from park text.
    """
    if not text:
        return None

    free_match = None
    for match in ENTRY_FEE_PATTERN.finditer(text):
        window = text[max(0, match.start() - 70) : match.end() + 110]
        amounts = [amount.strip() for amount in FEE_AMOUNT_PATTERN.findall(window)]
        if amounts:
            return "; ".join(dict.fromkeys(amounts))[:120]
        if free_match is None and FREE_PATTERN.search(window):
            free_match = "Free"
    return free_match


def detect_reservation(text, links):
    """
    Returns True when a reservation system or reservation language was found.
    """
    if any(RESERVATION_LINK_PATTERN.search(link) for link in links or []):
        return True
    return bool(text and RESERVATION_TEXT_PATTERN.search(text))


def detect_permit(text):
    """
    Returns True when a permit requirement was found, otherwise None (unknown).
    """
    if text and PERMIT_PATTERN.search(text):
        return True
    return None


# ---------------------------------------------------------------------------
# Entry fee tiers
# ---------------------------------------------------------------------------


def fee_windows(text):
    """
    Yields (start, end) character slices of park text that may describe entrance
    fees. Each fee heading runs until the next heading, the next annual-pass
    mention or 300 characters, whichever comes first.
    """
    anchors = list(FEE_ANCHOR_PATTERN.finditer(text))
    for index, match in enumerate(anchors):
        end = anchors[index + 1].start() if index + 1 < len(anchors) else len(text)
        end = min(end, match.end() + 300)
        for stopper in (ANNUAL_PATTERN, FEE_SUBCATEGORY_PATTERN):
            stop = stopper.search(text, match.end(), end)
            if stop:
                end = stop.start()
        if end > match.start():
            yield match.start(), end


def _clause_bounds(text, start, end, limit=80):
    """
    Returns (left, right) slice bounds of the sentence fragment around
    [start, end), stopping at sentence punctuation (., ;). Keeping context
    checks clause-local stops a neighbouring fee from bleeding in, e.g.
    "...per site or cabin). There is a $5 per vehicle park entry fee." or
    "..., and an additional $5 boat launch fee".
    """
    left_edge = max(0, start - limit)
    left_marks = [text.rfind(mark, left_edge, start) for mark in ".,;"]
    left = max(left_marks) + 1 if max(left_marks) >= 0 else left_edge
    right_edge = min(len(text), end + limit)
    right_marks = [text.find(mark, end, right_edge) for mark in ".,;"]
    found = [mark for mark in right_marks if mark >= 0]
    right = min(found) + 1 if found else right_edge
    return left, right


def parse_entry_fee(text):
    """
    Returns the entrance fee as a list of {"ageRange", "fee"} tiers, for example
    [{"ageRange": "4-11", "fee": "$3.00"}, {"ageRange": "62+", "fee": "$3.00"}].
    A fee with no age breakdown becomes a single tier with ageRange null; a page
    without any usable fee text returns null. The first fee window that carries
    age tiers wins, otherwise the first amount with entrance-fee context is used
    (checked inside its own clause only, so boat launch/camping prices are
    ignored), and the shared free-text detector is the last resort. Non-age
    admission modes priced with the tiers (e.g. "Individual/walk-in: $5.00") are
    kept as extra tiers labeled by mode.
    """
    if not text:
        return None

    for start, end in fee_windows(text):
        window = text[start:end]
        candidates = []
        seen = set()
        for match in AGE_TIER_PATTERN.finditer(window):
            if match.group(1) and match.group(2):
                label = f"{match.group(1)}-{match.group(2)}"
            elif match.group(3):
                label = f"{match.group(3)}+"
            elif match.group(4):
                label = f"{match.group(4)}+"
            elif match.group(6) and match.group(7):
                label = f"{match.group(6)}-{match.group(7)}"
            elif match.group(8):
                label = f"{match.group(8)}+"
            elif match.group(9) and match.group(10):
                label = f"{match.group(9)}-{match.group(10)}"
            elif match.group(11):
                label = f"{match.group(11)}+"
            else:
                label = f"{match.group(5)} and under"
            if label in seen:
                continue
            amount = TIER_FEE_PATTERN.search(window[match.end() : match.end() + 40])
            if not amount:
                continue
            seen.add(label)
            fee = amount.group(0)
            candidates.append(
                (match.start(), {"ageRange": label, "fee": "Free" if fee.lower() == "free" else fee})
            )
        for match in MODE_TIER_PATTERN.finditer(window):
            label = re.sub(r"\s+", " ", match.group(1)).strip()
            if label in seen:
                continue
            amount = TIER_FEE_PATTERN.search(window[match.end() : match.end() + 40])
            if not amount:
                continue
            seen.add(label)
            fee = amount.group(0)
            candidates.append(
                (match.start(), {"ageRange": label, "fee": "Free" if fee.lower() == "free" else fee})
            )
        if candidates:
            candidates.sort(key=lambda candidate: candidate[0])
            return [tier for _, tier in candidates]

    for match in FALLBACK_FEE_PATTERN.finditer(text):
        context = text[max(0, match.start() - 60) : match.end() + 60]
        if not ENTRY_CONTEXT_PATTERN.search(context):
            continue
        left, right = _clause_bounds(text, match.start(), match.end())
        if NON_ENTRY_CONTEXT_PATTERN.search(text[left:right]):
            continue
        fee = match.group(0).strip()
        return [{"ageRange": None, "fee": "Free" if fee.lower() == "free" else fee}]

    fee = detect_entry_fee(text)
    if fee:
        return [{"ageRange": None, "fee": fee}]
    return None


# ---------------------------------------------------------------------------
# Untracked activities
# ---------------------------------------------------------------------------


def collect_untracked_activities(texts, activity_ids, detected_names):
    """
    Returns the sorted names of activities listed on the park pages that the
    activities table does not track: recognised activity names with no table id
    plus any UNTRACKED_ACTIVITY_CANDIDATES term found in the page texts.
    """
    tracked = set(activity_ids)
    found = {name for name in detected_names if name not in tracked}
    texts = [text for text in texts if text]
    for name, pattern in UNTRACKED_ACTIVITY_PATTERNS.items():
        if name in tracked:
            continue
        if any(pattern.search(text) for text in texts):
            found.add(name)
    return sorted(found)


def _acquire_untracked_lock(timeout=60.0):
    """
    Locks the shared untrackedActivities.json so state scrapers that run at the
    same time cannot overwrite each other's findings.
    """
    deadline = time.time() + timeout
    while True:
        try:
            os.close(os.open(UNTRACKED_LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            return
        except FileExistsError:
            if time.time() >= deadline:
                # A killed run can leave the lock file behind; take it over
                # rather than blocking every later run forever.
                try:
                    os.unlink(UNTRACKED_LOCK)
                except OSError:
                    pass
                deadline = time.time() + timeout
            time.sleep(0.2)


def _release_untracked_lock():
    try:
        os.unlink(UNTRACKED_LOCK)
    except OSError:
        pass


def merge_untracked(names):
    """
    Merges newly found names into data/untrackedActivities.json and returns
    (total_entries, newly_added).

    Every state scraper funnels through here, so the file is the single shared
    backlog: the read/merge/write runs under a lock and lands atomically, which
    means states can be scraped in parallel without losing each other's
    findings, and the list only ever grows.
    """
    _acquire_untracked_lock()
    try:
        # Nothing to report and no backlog file: do not create one. This keeps
        # the file absent now that data/activities.json covers the scrapers.
        if not names and not os.path.exists(UNTRACKED_FILE):
            return 0, 0

        existing = []
        if os.path.exists(UNTRACKED_FILE):
            try:
                with open(UNTRACKED_FILE, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except (ValueError, OSError):
                existing = []

        seen = set()
        merged = []
        for row in existing:
            name = (row or {}).get("name")
            if name and name.casefold() not in seen:
                seen.add(name.casefold())
                merged.append({"name": name})

        added = 0
        for name in names or []:
            if name.casefold() not in seen:
                seen.add(name.casefold())
                merged.append({"name": name})
                added += 1

        merged.sort(key=lambda row: row["name"].casefold())
        temp_file = f"{UNTRACKED_FILE}.tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, UNTRACKED_FILE)
        return len(merged), added
    finally:
        _release_untracked_lock()


# ---------------------------------------------------------------------------
# List page parsing
# ---------------------------------------------------------------------------

_SMALL_WORDS = {"of", "and", "the", "at", "in", "on", "for", "to"}


def clean_park_name(name):
    """
    Collapses whitespace and strips footnote markers left in list cells
    ("Miner Lake State Park [ 148 ]").
    """
    name = re.sub(r"(?:\s*\[[^\]]{1,8}\])+\s*$", "", name or "")
    return " ".join(name.split())


def slug_to_name(href):
    """
    Derives a readable park name from a URL slug ("cheaha-state-park" ->
    "Cheaha State Park"). Used when a list page's anchor text is missing or is a
    generic label like "Learn more".
    """
    path = urlparse(href).path.rstrip("/")
    slug = path.rsplit("/", 1)[-1]
    slug = re.sub(r"\.(html?|php|aspx?)$", "", slug, flags=re.IGNORECASE)
    slug = slug.replace("_", "-")
    words = [word for word in slug.split("-") if word]
    if not words:
        return ""
    titled = [
        word.lower() if index and word.lower() in _SMALL_WORDS else word.capitalize()
        for index, word in enumerate(words)
    ]
    return " ".join(titled)


def parse_sitemap_list(soup, config, state_id):
    """
    List parser for XML sitemaps (CONFIG["list_kind"]: "sitemap"): every <loc>
    whose path matches CONFIG["park_path_pattern"] becomes a park record. Used
    for sites whose park index renders client side; the sitemap still lists every
    park page. Names come from the URL slug.
    """
    parks = []
    seen = set()
    for loc in soup.find_all("loc"):
        href = loc.get_text(strip=True)
        if not href:
            continue
        path = urlparse(href).path
        # A sitemap index lists child sitemaps; fetch and parse them so a site
        # that splits its sitemap across pages still yields every park.
        if re.search(r"sitemap[^/]*\.xml$", path, re.IGNORECASE):
            child = fetch(href)
            if child is not None:
                parks.extend(
                    parse_sitemap_list(BeautifulSoup(child.text, "html.parser"), config, state_id)
                )
            continue
        if not re.match(config["park_path_pattern"], path):
            continue
        link = urljoin(config["list_url"], path).rstrip("/")
        if link in seen:
            continue
        name = slug_to_name(path)
        if not name:
            continue
        seen.add(link)
        parks.append({"stateId": state_id, "name": name, "link": link})
    return parks


def _select_container(soup, selector=None):
    """
    Returns the element that holds the park links. A config supplied selector
    wins; otherwise the common main-content containers are tried so header,
    footer and sidebar copies of the links are skipped.
    """
    if selector:
        node = soup.select_one(selector)
        if node:
            return node
    for candidate in ("main", "#main", "#main-content", ".main-content", "#content", "body"):
        node = soup.select_one(candidate)
        if node:
            return node
    return soup


def _href_matches(anchor, pattern):
    """
    True when an anchor's href matches the park path pattern. The pattern is
    matched against the href itself for relative links and against path (+query)
    for absolute ones, because agencies use both forms for the same pages.
    """
    href = (anchor.get("href") or "").strip()
    if not href:
        return False
    if "://" in href:
        parsed = urlparse(href)
        candidate = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    else:
        candidate = href
    return bool(re.match(pattern, candidate))


def parse_list_page(soup, config, state_id):
    """
    Default list parser: collects anchors whose href matches
    CONFIG["park_path_pattern"], scoped to the content container, and returns
    records [{stateId, name, link}] deduplicated by link in page order.

    Name resolution: CONFIG["name_from"] may be "slug" (derive from the URL) or a
    callable(text, href) -> name; otherwise the anchor text is used, falling back
    to the slug when the text is empty or generic.
    """
    # Scoping to a container only happens when the state config asks for it; the
    # whole document is the default because many agencies render park cards
    # outside <main>, and link deduplication keeps header/footer copies harmless.
    container = _select_container(soup, config.get("container")) if config.get("container") else soup
    pattern = config["park_path_pattern"]

    anchors = []
    if config.get("link_selector"):
        anchors = container.select(config["link_selector"])
    if not anchors:
        anchors = [anchor for anchor in container.find_all("a", href=True) if _href_matches(anchor, pattern)]
    if not anchors:
        # Some sites render the park links outside <main> (cards, footers, map
        # widgets); fall back to the whole document before giving up.
        anchors = [anchor for anchor in soup.find_all("a", href=True) if _href_matches(anchor, pattern)]

    name_from = config.get("name_from")
    ignore_text = GENERIC_LINK_TEXT | {t.lower() for t in config.get("ignore_text", ())}
    exclude_slugs = {s.lower() for s in config.get("exclude_slugs", ())}

    parks = []
    seen = set()
    for anchor in anchors:
        href = anchor["href"].strip()
        if not _href_matches(anchor, pattern):
            continue

        link = urljoin(config["list_url"], href).rstrip("/")
        if link in seen:
            continue
        if exclude_slugs and urlparse(link).path.rstrip("/").rsplit("/", 1)[-1].lower() in exclude_slugs:
            continue

        text = clean_park_name(anchor.get_text(" ", strip=True))
        if callable(name_from):
            name = name_from(text, href)
        elif name_from == "slug":
            name = slug_to_name(href) or text
        else:
            name = text
            if not name or name.casefold() in ignore_text:
                name = slug_to_name(href)
        if not name:
            continue

        seen.add(link)
        parks.append({"stateId": state_id, "name": name, "link": link})

    return parks


# ---------------------------------------------------------------------------
# Boundary geodata (geoJSON / KML / ArcGIS)
# ---------------------------------------------------------------------------

# Attribute fields ArcGIS layers commonly use for a park's name.
_ARCGIS_NAME_FIELDS = (
    "name", "park_name", "parkname", "unit_name", "unitname", "site_name", "sitename",
    "facility", "facility_name", "label", "nm_park", "park_nam",
)


def _save_geojson(abbr, slug, payload):
    """
    Writes a GeoJSON payload under data/stateParks/geo/<abbr>/<slug>.geojson and
    returns its path relative to data/stateParks/ ("geo/tx/chincoteague.geojson").
    Returns None when the payload is not usable GeoJSON.
    """
    if isinstance(payload, (str, bytes)):
        try:
            payload = json.loads(payload)
        except ValueError:
            return None
    if not isinstance(payload, dict) or not isinstance(payload.get("type"), str):
        return None
    geojson_types = ("FeatureCollection", "Feature", "GeometryCollection", "Point", "MultiPoint",
                     "LineString", "MultiLineString", "Polygon", "MultiPolygon")
    if payload["type"] not in geojson_types:
        return None

    directory = os.path.join(GEO_DIR, abbr.lower())
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, f"{slug}.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return f"geo/{abbr.lower()}/{slug}.geojson"


_GENERIC_UNIT_WORDS = re.compile(
    r"\s+(?:state\s+)?(?:parks?|forests?|beaches|reserves?|natural areas?|preserve|"
    r"recreation areas?|historic parks?|historic sites?|memorial parks?|wildlife areas?|"
    r"scenic (?:parks?|preserves?)|waysides?)\b.*$",
    re.IGNORECASE,
)


def _layer_candidates(layer_url):
    """
    Returns the layer URLs to try for a service URL. ArcGIS services list their
    layers under "layers"; without an index we probe the first few so a plain
    ".../FeatureServer" in a state config still works.
    """
    if re.search(r"(?:feature|map)server/\d+$", layer_url, re.IGNORECASE):
        return [layer_url]

    response = fetch(f"{layer_url}?f=json")
    if response is None:
        return [layer_url]
    try:
        meta = response.json()
    except ValueError:
        return [layer_url]
    layer_ids = [layer.get("id") for layer in meta.get("layers", []) if layer.get("id") is not None]
    if not layer_ids:
        return [layer_url]
    return [f"{layer_url}/{layer_id}" for layer_id in layer_ids[:4]]


def _name_needles(park_name):
    """
    Candidate search strings for a park name, most specific first: the full name,
    then the name without its generic unit words ("Silver Falls State Park" ->
    "Silver Falls"), then the first two words ("Silver Falls").
    """
    needles = [park_name]
    trimmed = _GENERIC_UNIT_WORDS.sub("", park_name).strip()
    if trimmed and trimmed != park_name:
        needles.append(trimmed)
    words = trimmed.split()
    if len(words) > 2:
        needles.append(" ".join(words[:2]))
    return list(dict.fromkeys(needle for needle in needles if len(needle) >= 4))


def arcgis_layer_to_geojson(layer_url, park_name):
    """
    Queries an ArcGIS FeatureServer/MapServer layer for a park by name and returns
    a GeoJSON payload (or None when the layer has no match or does not support
    GeoJSON output). The layer's metadata decides which field holds the name, and
    the park name is tried with and without its generic unit words because most
    layers store "Silver Falls" rather than "Silver Falls State Park".
    """
    layer_url = layer_url.split("?")[0].rstrip("/")
    if not re.search(r"(?:feature|map)server(?:/\d+)?$", layer_url, re.IGNORECASE):
        return None

    for candidate_url in _layer_candidates(layer_url):
        response = fetch(f"{candidate_url}?f=json")
        if response is None:
            continue
        try:
            meta = response.json()
        except ValueError:
            continue

        fields = [field.get("name", "") for field in meta.get("fields", []) if field.get("name")]
        if not fields:
            continue
        lowered = {field.lower(): field for field in fields}
        name_field = next((lowered[key] for key in _ARCGIS_NAME_FIELDS if key in lowered), None)
        if name_field is None:
            name_field = next((field for field in fields if field.lower().endswith("name")), fields[0])

        for needle in _name_needles(park_name):
            where = f"UPPER({name_field}) LIKE '%{needle.upper().replace(chr(39), chr(39) * 2)}%'"
            query = f"{candidate_url}/query?{urlencode({'where': where, 'outFields': '*', 'f': 'geojson'})}"
            response = fetch(query)
            if response is None:
                continue
            try:
                payload = response.json()
            except ValueError:
                continue
            if payload.get("features"):
                return payload
    return None


def resolve_boundary(park_name, park_slug, boundary_links, config, abbr):
    """
    Turns boundary signals found on a park page into a record value:
    * .geojson files are downloaded to data/stateParks/geo/<abbr>/ -> relative path
    * ArcGIS FeatureServer/MapServer layers are queried by park name -> relative path
    * .kml/.kmz files cannot be converted here, so their URL is recorded as-is
    * CONFIG["boundary_service"] (an ArcGIS layer) is tried for every park
    Returns a string (relative data/ path or URL) or None when nothing usable
    was found. All failures are silent except for a printed note, because
    boundary data is best effort.
    """
    candidates = list(boundary_links or [])
    service = config.get("boundary_service")
    if service:
        candidates.insert(0, service)

    for raw in candidates:
        url = urljoin(config["list_url"], raw)
        if re.search(r"\.(?:kml|kmz)(?:\?|#|$)", url, re.IGNORECASE):
            return url
        if re.search(r"\.geojson(?:\?|#|$)", url, re.IGNORECASE):
            response = fetch(url)
            if response is None:
                continue
            saved = _save_geojson(abbr, park_slug, response.text)
            if saved:
                return saved
            continue
        if re.search(r"(?:feature|map)server(?:/\d+)?(?:/query)?(?:\?|$)", url, re.IGNORECASE):
            payload = arcgis_layer_to_geojson(url, park_name)
            if payload:
                saved = _save_geojson(abbr, park_slug, payload)
                if saved:
                    return saved
            continue
        if BOUNDARY_GIS_HINT_PATTERN.search(url) and url.lower().split("?")[0].endswith(".json"):
            response = fetch(url)
            if response is None:
                continue
            saved = _save_geojson(abbr, park_slug, response.text)
            if saved:
                return saved
    return None


# ---------------------------------------------------------------------------
# Driver: scrape, enrich, summary, CLI
# ---------------------------------------------------------------------------


def state_slug(state_name):
    """
    Stable lowercase file/cache slug for a state ("New Hampshire" ->
    "newhampshire", used for newhampshireParks.json and .cache/newhampshire.json).
    """
    return re.sub(r"[^a-z0-9]+", "", state_name.lower())


def default_output_file(config):
    """
    Returns data/stateParks/<state>Parks.json for a state config.
    """
    return os.path.join(OUTPUT_DIR, f"{state_slug(config['state'])}Parks.json")


def default_campground_file(config):
    """
    Returns data/stateParks/<state>_campgrounds.json for a state config.
    """
    return os.path.join(OUTPUT_DIR, f"{state_slug(config['state'])}_campgrounds.json")


def park_slug(link):
    """
    Filesystem-safe slug for a park's boundary file, derived from its URL.
    """
    segment = urlparse(link).path.rstrip("/").rsplit("/", 1)[-1]
    slug = re.sub(r"[^a-z0-9]+", "-", segment.lower()).strip("-")
    return slug or "park"


def _blank_details(park):
    """
    Keeps the full record shape even when pages are not fetched.
    """
    park.setdefault("reservationAvailable", False)
    park.setdefault("entryFee", None)
    park.setdefault("permitRequired", False)
    park.setdefault("activities", [])
    park.setdefault("boundary", None)


def collect_campgrounds(records, config, state_id, cache):
    """
    Splits campground records out of a state's park list and returns
    (parks, campgrounds).

    Campgrounds are recognised in two ways, both optional:
    * CONFIG["campground_list_url"] - a dedicated campground index (Alaska's
      "Alaska State Park Campgrounds"). Its units are campgrounds, matched with
      CONFIG["campground_path_pattern"] (defaults to park_path_pattern) or parsed
      by CONFIG["campground_parse_list"] when the index needs its own rules. A
      unit that appears in both lists keeps the fuller name from the park list and
      moves to the campground list, so it is never written twice - unless
      CONFIG["campgrounds_shared_with_parks"] says the index repeats the park
      pages (Arkansas' camping index), in which case each unit stays a park and
      the index's records are added to the campground file as well.
    * CONFIG["campground_pattern"] - a regex tested against "<name> <link>" for
      states that mix campground pages into their park index without listing them
      separately.

    A state with neither key returns (records, []) and keeps writing a single
    parks file.
    """
    campground_list_url = config.get("campground_list_url")
    campground_pattern = config.get("campground_pattern")
    if not campground_list_url and not campground_pattern:
        return records, []
    if isinstance(campground_pattern, str):
        campground_pattern = re.compile(campground_pattern)

    # link -> name from the campground index (only used for campground-only links)
    campground_names = {}
    if campground_list_url:
        campground_config = dict(config)
        campground_config["list_url"] = campground_list_url
        # Hand the cache to the campground parser the same way the park parser
        # gets it, so state parsers that crawl sub-indexes reuse fetched pages.
        campground_config["_cache"] = cache
        campground_config["park_path_pattern"] = (
            config.get("campground_path_pattern") or config["park_path_pattern"]
        )
        campground_parser = config.get("campground_parse_list") or parse_list_page
        for page_url, entry in collect_list_html(campground_list_url, campground_config, cache):
            if entry.get("status") != 200 or not entry.get("html"):
                print(f"  ! campground list unavailable: {page_url}")
                continue
            soup = BeautifulSoup(entry["html"], "html.parser")
            for record in campground_parser(soup, campground_config, state_id):
                campground_names.setdefault(record["link"], record["name"])

    shared_with_parks = bool(config.get("campgrounds_shared_with_parks"))
    parks = []
    campgrounds = []
    seen = set()
    for record in records:
        is_campground = bool(
            campground_pattern
            and campground_pattern.search(f"{record['name']} {record['link']}")
        )
        if not is_campground and not shared_with_parks and record["link"] in campground_names:
            is_campground = True
        if is_campground:
            campgrounds.append(record)
            seen.add(record["link"])
        else:
            parks.append(record)

    # Campground pages the park list does not carry at all still belong in the
    # campground file (name from the campground index).
    for link, name in campground_names.items():
        if link in seen:
            continue
        campgrounds.append({"stateId": state_id, "name": name, "link": link})
        seen.add(link)

    if campgrounds:
        print(f"  {len(campgrounds)} campground records split out for "
              f"{default_campground_file(config).rsplit('/', 1)[-1]}")
    return parks, campgrounds


def finalize_campground_records(records):
    """
    Renames a campground record's entryFee to siteFee (a campground charge is a
    site fee, not an entry fee) and restores the documented key order.
    """
    finalized = []
    for record in records:
        site_fee = record.pop("entryFee", None)
        finalized.append({
            "stateId": record["stateId"],
            "name": record["name"],
            "link": record["link"],
            "reservationAvailable": record.get("reservationAvailable", False),
            "siteFee": site_fee,
            "permitRequired": record.get("permitRequired", False),
            "activities": record.get("activities", []),
            "boundary": record.get("boundary"),
        })
    return finalized


def scrape(config, include_details=True, cache=None):
    """
    Scrapes one state's park list and returns (records, cache). With
    include_details (default) each park page is descended into for the
    reservationAvailable/entryFee/permitRequired/activities/boundary signals;
    otherwise those fields keep their unknown defaults.
    """
    state_id = load_state_id(config["abbr"])
    slug = state_slug(config["state"])
    if cache is None:
        cache = load_cache(slug)

    list_pages = collect_list_html(config["list_url"], config, cache)
    list_entry = list_pages[0][1] if list_pages else {}

    parks = []
    if list_entry.get("status") == 200 and list_entry.get("html"):
        # Hand the cache to the parser so state specific list parsers can fetch
        # (and thereby cache) pages whose titles they need for park names.
        parse_config = dict(config)
        parse_config["_cache"] = cache
        # A state specific parse_list always wins; otherwise sitemap mode or the
        # default anchor parser handles the list page.
        if config.get("parse_list"):
            parser = config["parse_list"]
        elif config.get("list_kind") == "sitemap":
            parser = parse_sitemap_list
        else:
            parser = parse_list_page
        for _page_url, entry in list_pages:
            if entry.get("status") != 200 or not entry.get("html"):
                continue
            soup = BeautifulSoup(entry["html"], "html.parser")
            parks.extend(parser(soup, parse_config, state_id))
        parks = dedupe_records(parks)
    else:
        status = list_entry.get("status")
        note = "blocked or unreachable" if status in (None, 403, 406, 429, 503) else f"HTTP {status}"
        print(f"  ! park list unavailable ({note}): {config['list_url']}")
        print("    the scraper still runs; a later attempt may succeed once the site allows us")

    parks, campgrounds = collect_campgrounds(parks, config, state_id, cache)
    everything = parks + campgrounds

    if include_details and everything:
        pages = enrich_parks(everything, config, cache, slug)
        # Campgrounds a park page links are campground records too; mine the park
        # pages only so campground pages cannot cascade into more campground pages.
        skip = {record["link"] for record in everything}
        campgrounds.extend(mine_campgrounds(parks, pages, config, cache, state_id, skip))
        # The Usedirect reservation API (Arizona): /reserve is a single-page app
        # with no campground links, so its facilities are collected separately.
        campgrounds.extend(collect_usedirect_campgrounds(config, state_id))
    else:
        for record in everything:
            _blank_details(record)
        save_cache(cache, slug)

    return parks, finalize_campground_records(campgrounds), cache


def _fetch_pages(urls, config, cache, label):
    """
    Fetches each url once (in parallel, cached between runs) and returns
    {url: page entry}. The caller owns cache writes so worker threads never mutate
    the cache while it is being serialized.
    """
    urls = sorted(urls)
    if not urls:
        return {}
    print(f"Fetching {len(urls)} {label}...")
    pages = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for index, (url, entry) in enumerate(
            pool.map(lambda page_url: (page_url, fetch_page(page_url, cache, config)), urls), start=1
        ):
            pages[url] = entry
            cache[url] = entry
            if entry["status"] != 200:
                print(f"  ! [{index}/{len(urls)}] {entry['status']} {url}")
            elif index % 10 == 0 or index == len(urls):
                print(f"  ...{index}/{len(urls)} {label} fetched")
    return pages


def _apply_page_signals(record, entry, config, activity_ids):
    """
    Copies the reservation, fee, permit, activity and boundary signals from one
    fetched page onto one record. Returns True when a boundary was resolved.
    """
    text = entry.get("text", "")
    record["reservationAvailable"] = detect_reservation(text, entry.get("reservationLinks"))
    record["entryFee"] = parse_entry_fee(text)
    record["permitRequired"] = bool(detect_permit(text))
    names = detect_activities(text)
    record["activities"] = sorted(activity_ids[name] for name in names if name in activity_ids)
    record["boundary"] = resolve_boundary(
        record["name"], park_slug(record["link"]), entry.get("boundaryLinks"), config, config["abbr"]
    )
    return bool(record["boundary"])


def _report_untracked(page_entries, activity_ids, detected_names):
    """
    Reports activities a page mentions that have no activities table row.
    """
    untracked = collect_untracked_activities(
        (entry.get("text", "") for entry in page_entries), activity_ids, detected_names
    )
    if untracked:
        total, added = merge_untracked(untracked)
        print(f"  untracked activities missing from the table: {total} ({added} new) -> {UNTRACKED_FILE}")
    else:
        print("  untracked activities: none, every detected activity is in the activities table")


def enrich_parks(parks, config, cache, slug):
    """
    Fetches every park page once (cached between runs) and merges the reservation,
    entry fee, permit, activity and boundary signals into the records. Returns the
    fetched pages so the campground pass can mine their links.
    """
    pages = _fetch_pages({park["link"] for park in parks}, config, cache, "park pages")
    if not pages:
        return pages

    activity_ids = load_activity_ids()
    detected_names = set()
    boundaries = 0
    for park in parks:
        entry = pages.get(park["link"]) or {}
        detected_names.update(detect_activities(entry.get("text", "")))
        if _apply_page_signals(park, entry, config, activity_ids):
            boundaries += 1

    print(f"  boundary geodata resolved for {boundaries}/{len(parks)} parks")
    _report_untracked(pages.values(), activity_ids, detected_names)
    save_cache(cache, slug)
    return pages


def mine_campgrounds(records, pages, config, cache, state_id, skip_links):
    """
    Builds campground records from the campground links found on the park pages that
    were just fetched, then fetches those campground pages and applies the same
    signals. This is how most agencies publish camping: a park page links its own
    campground page rather than a separate campground index.
    """
    if not pages or config.get("campground_links") is False:
        return []

    candidates = {}
    for record in records:
        entry = pages.get(record["link"]) or {}
        for pair in entry.get("campgroundLinks") or []:
            link, text = pair[0], pair[1]
            if link in skip_links:
                continue
            name = campground_name_from(text, link, record["name"])
            if not name or not is_campground_name(name):
                continue
            candidates.setdefault(link, name)
    if not candidates:
        return []

    print(f"  {len(candidates)} campground pages linked from the park pages")
    campgrounds = [
        {"stateId": state_id, "name": name, "link": link} for link, name in candidates.items()
    ]
    camp_pages = _fetch_pages(candidates, config, cache, "campground pages")
    activity_ids = load_activity_ids()
    detected_names = set()
    boundaries = 0
    for record in campgrounds:
        entry = camp_pages.get(record["link"]) or {}
        detected_names.update(detect_activities(entry.get("text", "")))
        if _apply_page_signals(record, entry, config, activity_ids):
            boundaries += 1

    print(f"  boundary geodata resolved for {boundaries}/{len(campgrounds)} campgrounds")
    _report_untracked(camp_pages.values(), activity_ids, detected_names)
    save_cache(cache, state_slug(config["state"]))
    return campgrounds


# Usedirect campground provider (Arizona)
# ---------------------------------------------------------------------------


def _fetch_json(url):
    """GETs a JSON endpoint, returning the parsed payload or None on failure."""
    response = fetch(url)
    if response is None:
        return None
    try:
        return response.json()
    except ValueError:
        print(f"    ! non-JSON response for {url}")
        return None


# Usedirect facility names are terse loop names ("Campground A Loop", "Gila
# Loop", "Oak Woodland RV"), so they get their own filter: a positive camping
# word is required, which drops the cabins/lodges/day-use/classrooms the same
# API carries. Day-use boat-in sites are excluded while overnight ones stay.
USEDRECT_CAMP_PATTERN = re.compile(
    r"(?i)(campground|campsite|camp-site|camp loop|cabin loop|\bloop\b|"
    r"hike-in|boat-in|tent|overflow|ramada|\brv\b)"
)
USEDRECT_JUNK_PATTERN = re.compile(
    r"(?i)(day.use|natural bridge|classroom|lodge|terrainhopper)"
)


def is_usedirect_campground(name):
    """True when a Usedirect facility name reads like reservable camping."""
    if not name or len(name) > 90:
        return False
    if USEDRECT_JUNK_PATTERN.search(name):
        return False
    return bool(USEDRECT_CAMP_PATTERN.search(name))


def _norm_place_words(text):
    """Splits text into words, unifying abbreviations ("mtn" -> "mountain")."""
    return ["mountain" if word == "mtn" else
            "mountains" if word == "mtns" else word
            for word in text.casefold().split()]


def _match_place_to_park(place_name, park_links):
    """
    Maps a Usedirect place name ("Buckskin Mountain") back to its park-list URL.

    Place names are short while park names carry the type word and sometimes an
    abbreviation ("Buckskin Mtn State Park"), so an exact match is tried first,
    then each known short park name that is a word-prefix of the place (and vice
    versa, for "Fool Hollow Lake" vs the "Fool Hollow Lake Recreation Area"
    listing). A bare prefix match is not enough: "Buckskin" is also a word
    prefix of "Buckskin Mountain", so the shared prefix must reach a word
    boundary on both sides or differ by at most the trailing "s" ("Mtn" vs
    "Mountain").
    """
    if not place_name:
        return ""
    key = place_name.casefold()
    if key in park_links:
        return park_links[key]
    words = _norm_place_words(place_name)
    for short, link in park_links.items():
        if short == key or len(short) < 3:
            continue
        short_words = _norm_place_words(short)
        shared = 0
        while (shared < len(words) and shared < len(short_words)
               and (words[shared] == short_words[shared]
                    or words[shared] == short_words[shared] + "s"
                    or short_words[shared] == words[shared] + "s")):
            shared += 1
        if shared and (shared == len(words) or shared == len(short_words)):
            return link
    return ""


def fetch_usedirect_campgrounds(base_url, park_links=None, exclude_places=None):
    """
    Builds campground records from a Usedirect (usedirect.com) reservation API.

    The /reserve widgets states embed are single-page apps: the static HTML has
    no campground links, so the generic mine_campgrounds pass finds nothing. But
    the JSON endpoints behind them are public:

      {base}/fd/places                 all reservable places (parks)
      {base}/fd/facilities/{id}        one reservable facility (campground loop, cabins, ...)

    Facility ids 1..N are scanned (stops after 15 consecutive misses); each
    facility whose name reads like camping becomes one campground record linked
    to its park's page when park_links maps "place name" -> park URL, else to
    the /reserve widget itself. Places in the exclude set are skipped (cabins,
    classrooms, ... carried by the same API).
    Returns a list of bare (stateless) records plus a {link: [texts]} map used
    for their activity signals.
    """
    exclude_places = exclude_places or set()
    park_links = park_links or {}

    places_payload = _fetch_json(f"{base_url}/fd/places")
    if not isinstance(places_payload, list) or not places_payload:
        print("  ! usedirect places unavailable")
        return [], {}
    places = {
        place.get("PlaceId"): place.get("Name")
        for place in places_payload
        if isinstance(place, dict) and place.get("PlaceId") not in exclude_places
    }
    print(f"  {len(places)} usedirect places")

    seen = set()
    campgrounds = []
    descriptions = {}
    facility_id = 1
    misses = 0
    while misses < 15:
        facility = _fetch_json(f"{base_url}/fd/facilities/{facility_id}")
        facility_id += 1
        if not isinstance(facility, dict) or not facility.get("Name"):
            misses += 1
            continue
        misses = 0
        name = (facility.get("Name") or "").strip()
        place_id = facility.get("PlaceId")
        if not name or not is_usedirect_campground(name) or place_id in exclude_places:
            continue
        key = (place_id, name.casefold())
        if key in seen:
            continue
        seen.add(key)
        place_name = places.get(place_id, "")
        park_link = _match_place_to_park(place_name, park_links)
        record_name = f"{place_name} - {name}" if place_name else name
        link = park_link or "https://azstateparks.com/reserve/"
        campgrounds.append({"name": record_name, "link": link})
        for extra_key in ("Description", "ShortName"):
            text = (facility.get(extra_key) or "").strip()
            if text and text.casefold() != name.casefold():
                descriptions.setdefault(link, []).append(text)

    print(f"  {len(campgrounds)} usedirect campground facilities")
    return campgrounds, descriptions


def enrich_usedirect_campgrounds(campgrounds, descriptions, state_id):
    """
    Applies the shared activity signals to usedirect campground records. The
    widget API carries no fee/permit/boundary data, so reservation defaults to
    True (every record comes from the reservation system), siteFee stays null
    and only activities are detected, from the facility's own description text.
    """
    activity_ids = load_activity_ids()
    detected_names = set()
    for record in campgrounds:
        record["stateId"] = state_id
        record["reservationAvailable"] = True
        record["siteFee"] = None
        record["permitRequired"] = False
        blob = " ".join([record["name"], *descriptions.get(record["link"], [])])
        names = detect_activities(blob)
        detected_names.update(names)
        record["activities"] = sorted(activity_ids[name] for name in names if name in activity_ids)
        record["boundary"] = None
    _report_untracked(
        ({"text": " ".join([record["name"], *descriptions.get(record["link"], [])])}
         for record in campgrounds),
        activity_ids,
        detected_names,
    )
    return finalize_campground_records(campgrounds)


def collect_usedirect_campgrounds(config, state_id):
    """
    Runs the usedirect campground provider when a state config carries a
    "usedirect" section (Arizona). Returns finalized campground records, or []
    when the section is absent, so scrape() stays untouched for other states.
    """
    section = config.get("usedirect")
    if not section:
        return []
    # Match each facility's place back to the park list so campground records
    # link the park page. Place names are short ("Alamo Lake") while park names
    # carry the type word ("Alamo Lake State Park"), so match on prefix (see
    # _match_place_to_park for the word-boundary guard).
    park_links = {}
    if section.get("match_parks") and config.get("list_url"):
        soup = fetch_soup(config["list_url"])
        if soup is not None:
            records = parse_list_page(soup, config, state_id)
            for record in records:
                park_links.setdefault(record["name"].casefold(), record["link"])
            for record in records:
                short = record["name"].casefold()
                # Strip the unit type word ("Alamo Lake State Park" -> "alamo
                # lake") and known short forms ("Buckskin Mtn State Park" ->
                # "buckskin mountain"). Buckskin's listing name ("Buckskin
                # Mountain") only shares the "buckskin" prefix, so prefix-match
                # needs a park-boundary guard (see _match_place_to_park).
                for word in (" state historic park", " state recreation area",
                             " state natural area", " state park"):
                    if word in short:
                        short = short.split(word)[0]
                        break
                short = short.replace(" mtn ", " mountain ").replace(
                    " mtns ", " mountains ")
                park_links.setdefault(short, record["link"])
                # The no-lake prefix ("fool hollow") must not point at the Lake
                # park: "Fool Hollow Lake" and "Fool Hollow Lake Recreation
                # Area" are distinct parks sharing a longer prefix.
                if short.endswith(" lake"):
                    tail = short[: -len(" lake")]
                    if not any(other != short and other.startswith(tail + " ")
                               for other in [r["name"].casefold()
                                             for r in records]):
                        park_links.setdefault(tail, record["link"])
    bare, descriptions = fetch_usedirect_campgrounds(
        section["base_url"],
        park_links=park_links,
        exclude_places=set(section.get("exclude_places") or ()),
    )
    if not bare:
        return []
    return enrich_usedirect_campgrounds(bare, descriptions, state_id)


def print_summary(records, label="parks"):
    """
    Logs coverage per field so gaps in the data are obvious. Works for both park
    records (entryFee) and campground records (siteFee).
    """
    fee_key = "siteFee" if records and "siteFee" in records[0] else "entryFee"
    print(f"\nSummary ({label})")
    print(f"  records:              {len(records)}")
    print(f"  reservationAvailable: {sum(1 for record in records if record['reservationAvailable'])}")
    print(f"  {fee_key + ' detected':<21} {sum(1 for record in records if record.get(fee_key))}")
    print(f"  permitRequired:       {sum(1 for record in records if record['permitRequired'])}")
    print(f"  activities detected:  {sum(1 for record in records if record['activities'])}")
    print(f"  boundary geodata:     {sum(1 for record in records if record['boundary'])}")


def _write_records(records, path, label):
    """
    Writes records to path, but refuses to replace an existing, non-empty file with
    an empty result: a blocked site or a rate-limited run must not wipe good data.
    """
    if not records and os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                existing = json.load(f)
        except (ValueError, OSError):
            existing = []
        if existing:
            print(f"\n! keeping the existing {path}: this run produced no {label} "
                  f"(the site may be blocking us right now)")
            return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    return True


def run(config):
    """
    Standard CLI for a state scraper: parses --skip-details/--output, runs the
    scrape and writes the records to data/stateParks/<state>Parks.json.
    """
    default_output = default_output_file(config)
    parser = argparse.ArgumentParser(
        description=(
            f"Scrape {config['state']} state parks from "
            f"{urlparse(config['list_url']).netloc} into "
            f"data/stateParks/{os.path.basename(default_output)}"
        )
    )
    parser.add_argument(
        "--skip-details",
        action="store_true",
        help="skip fetching park pages for reservation/entry fee/permit details",
    )
    parser.add_argument("--output", default=default_output, help=f"output file (default: {default_output})")
    args = parser.parse_args()

    parks, campgrounds, _cache = scrape(config, include_details=not args.skip_details)
    print(f"Found {len(parks)} parks on {config['list_url']}")
    print_summary(parks)

    if _write_records(parks, args.output, "parks"):
        print(f"\nSuccessfully wrote {len(parks)} park records to {args.output}")

    # Campgrounds go to their own file. A unit an index shares with the park list
    # (Arkansas' camping index) stays in the parks file as well; every other unit
    # is written once. The canonical run writes
    # data/stateParks/<state>_campgrounds.json; a custom --output keeps both files
    # side by side instead.
    if campgrounds:
        if os.path.abspath(args.output) == os.path.abspath(default_output):
            campground_output = default_campground_file(config)
        elif args.output.endswith(".json"):
            campground_output = f"{args.output[:-len('.json')]}_campgrounds.json"
        else:
            campground_output = default_campground_file(config)
        print_summary(campgrounds, "campgrounds")
        if _write_records(campgrounds, campground_output, "campgrounds"):
            print(f"\nSuccessfully wrote {len(campgrounds)} campground records to {campground_output}")
    return parks, campgrounds
