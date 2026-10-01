"""
Scrapes one record per individual U.S. state park into server/data/stateParks/stateParks.json.

Pipeline
--------
1. Discovery  - Wikipedia "List of <State> state parks" pages (discovered from
   https://en.wikipedia.org/wiki/List_of_U.S._state_parks) provide the park names, the
   Wikipedia article for every park and the state a park belongs to.
2. Articles   - the MediaWiki API returns raw wikitext for many parks per request. The
   infobox provides the park's official website (used as the park info link) and the
   location field provides any additional states a park spans.
3. Agencies   - states registered in AGENCY_PARK_LISTS have their official park index
   crawled, so records can point at the agency's own park page (e.g. alapark.com) and
   parks that are missing from the Wikipedia list are still included.
4. Defaults   - https://www.stateparks.org/api/content/naspd/state-directory provides the
   state agency homepage (fallback link) and a state level reservation signal.
5. Details    - when a park links to a non-Wikipedia website, that page is fetched (and
   cached under server/scrapers/.cache/) to detect reservation availability, entry fees,
   permit requirements and additional activities. Sites that block scraping simply leave
   those fields unknown.

Output record
-------------
[
  {
    "stateId": 1,                        # 1-based id from data/states.json (one record per state)
    "name": "Cheaha State Park",
    "link": "https://www.alapark.com/parks/cheaha-state-park",
    "reservationAvailable": true,        # park signal, else the state agency signal, else false
    "entryFee": "$5 per vehicle",         # best effort fee description, null when unknown
    "permitRequired": true,               # true when a permit requirement is found, null when unknown
    "activities": ["Hiking", "Walking"]   # names from data/activities.json
  }
]

Notes
-----
* A park that spans several states (Breaks Interstate Park) produces one record per state.
* Park links use the best page available: agency park page, official website from the
  infobox, the Wikipedia article, and only then the state agency homepage.
* Activities are matched from keywords in the Wikipedia list row, the article prose and the
  park page. Site menus, headers and footers are stripped before matching so an activity an
  agency advertises site wide does not leak into every park of that agency.
* entryFee/permitRequired are best effort; a null simply means the sources did not say.
* camping, fishing, swimming and similar activities are not reported: data/activities.json
  has no matching row, and mapping them all onto "Other" would not be useful.

Usage
-----
    .venv/bin/python stateParksScraper.py                    # full nationwide run
    .venv/bin/python stateParksScraper.py --states AL,ME,TX  # subset of states
    .venv/bin/python stateParksScraper.py --skip-details     # discovery only (fast, no agency page fetches)
"""

import argparse
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import unquote, urljoin

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data"))
STATES_FILE = os.path.join(DATA_DIR, "states.json")
ACTIVITIES_FILE = os.path.join(DATA_DIR, "activities.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "stateParks", "stateParks.json")
CACHE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".cache/stateParksCache.json"))

WIKIPEDIA_BASE = "https://en.wikipedia.org"
STATE_LIST_INDEX_URL = f"{WIKIPEDIA_BASE}/wiki/List_of_U.S._state_parks"
WIKIPEDIA_API_URL = f"{WIKIPEDIA_BASE}/w/api.php"
STATE_DIRECTORY_API = (
    "https://www.stateparks.org/api/content/naspd/state-directory?$top=60&$orderby=data/stateName/iv%20asc"
)
# stateparks.org is a Squidex CMS, so its JSON fields are wrapped unless they are flattened.
STATE_DIRECTORY_HEADERS = {"X-Flatten": "1"}

# Wikimedia asks for a descriptive user agent: https://meta.wikimedia.org/wiki/User-Agent_policy
WIKIPEDIA_HEADERS = {
    "User-Agent": "test-agent-state-parks-scraper/1.0 (https://github.com/JonathanRys/test_agent)",
    "Accept-Language": "en-US,en;q=0.9",
}
# State agency sites are served by a mixed bag of WAFs, so present a normal browser profile.
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 25
MAX_WORKERS = 6
WIKITEXT_BATCH_SIZE = 20
CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
CACHE_TEXT_LIMIT = 20000


# ---------------------------------------------------------------------------
# Source configuration
# ---------------------------------------------------------------------------

# State agency park indexes keyed by state name. Each entry adds the agency's own park pages
# to the records (link override) and catches parks the Wikipedia list does not cover.
AGENCY_PARK_LISTS = {
    "Alabama": {
        "url": "https://www.alapark.com/parks",
        "base": "https://www.alapark.com",
        "link_pattern": r"^/parks/[^/]+/?$",
    },
}

# Keywords used to recognise an activity from park text. Keys must exist in data/activities.json.
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
    "Downhill Skiing": r"\bdownhill ski(?:ing)?\b|\balpine ski(?:ing)?\b",
    "Cross-country Skiing": r"\bcross[- ]country ski(?:ing)?\b|\bnordic ski(?:ing)?\b|\bxc ski(?:ing)?\b",
    "Snowboarding": r"\bsnowboard(?:s|ing|ers?)?\b",
    "Skate Skiing": r"\bskate ski(?:ing)?\b",
    "Snowshoeing": r"\bsnowsho(?:e|es|eing|ing)\b",
    "Snowmobiling": r"\bsnowmobil(?:e|es|ing|ers?)\b",
    "Kayaking": r"\bkayak(?:s|ing|ers?)?\b",
    "Canoeing": r"\bcanoe(?:s|ing|ists?)?\b",
    "Whitewater Rafting": r"\bwhite[- ]?water\b|\brafting\b|\braft trips?\b",
    "Horseback Riding": r"\bhorseback (?:riding|trails?)\b|\bequestrian\b|\bhorse trails?\b",
}
ACTIVITY_PATTERNS = {name: re.compile(pattern, re.IGNORECASE) for name, pattern in ACTIVITY_KEYWORDS.items()}

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

# Wikipedia tables that list former/decommissioned parks or non-park units.
EXCLUDED_TABLE_HEADER_WORDS = (
    "trail",
    "former",
    "decommissioned",
    "disestablished",
    "date removed",
    "percent",
)
PARK_HEADER_WORDS = ("name", "park", "site")
EXCLUDED_ROW_NAMES = (
    "total",
    "acres",
    "former or alternate name",
    "current park name",
    "annual visits",
)
PARK_LIST_HINT = re.compile(
    r"\bstate (?:park|recreation|historic|wayside|monument|reserve|beach|forest|scenic|natural)",
    re.IGNORECASE,
)
STOP_HEADINGS = re.compile(
    r"^(see also|references|external links|further reading|notes|sources|bibliography|gallery)$",
    re.IGNORECASE,
)
FEE_AMOUNT_PATTERN = re.compile(r"\$\s?\d{1,3}(?:\.\d{2})?(?:\s*(?:per|each|a)\s+[a-z]+|/\s*[a-z]+)?", re.IGNORECASE)
FREE_PATTERN = re.compile(r"\bfree\b", re.IGNORECASE)

# Site chrome (menus, headers, footers) repeats across every park page of an agency, so it is
# removed before keyword detection. Sidebars are kept because agencies often keep hours and
# entrance fees there.
NAVIGATION_HINT = re.compile(
    r"(^|[-_])(menu|navbar|mega|breadcrumb|tabs?|header|footer|social|drawer|offcanvas)([-_]|$)",
    re.IGNORECASE,
)


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
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_maxsize=MAX_WORKERS)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def get_session(headers):
    """
    Returns a thread local session for a header profile so parallel workers do not share a
    connection pool.
    """
    sessions = getattr(SESSION_LOCAL, "sessions", None)
    if sessions is None:
        sessions = {}
        SESSION_LOCAL.sessions = sessions

    key = tuple(sorted(headers.items()))
    if key not in sessions:
        sessions[key] = build_http_session(headers)
    return sessions[key]


def fetch(url, headers=None, params=None, extra_headers=None):
    """
    Performs a GET request and returns the response, or None when the site refuses to cooperate.
    """
    try:
        response = get_session(headers or BROWSER_HEADERS).get(
            url,
            params=params,
            headers=extra_headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        print(f"    ! request failed for {url}: {type(exc).__name__}")
        return None


def soup_of(url, headers=None, params=None, extra_headers=None):
    """
    Fetches a page and returns it as a BeautifulSoup document, or None on failure.
    """
    response = fetch(url, headers=headers, params=params, extra_headers=extra_headers)
    if response is None:
        return None
    return BeautifulSoup(response.text, "html.parser")


# ---------------------------------------------------------------------------
# Local data files
# ---------------------------------------------------------------------------


def load_states():
    """
    Loads states.json and returns {state name: 1-based stateId} and {abbreviation: state name}.
    """
    with open(STATES_FILE, "r", encoding="utf-8") as f:
        states_data = json.load(f)

    by_name = {}
    by_abbreviation = {}
    for index, state in enumerate(states_data, start=1):
        by_name[state["name"]] = index
        by_abbreviation[state["abbreviation"].upper()] = state["name"]
    return by_name, by_abbreviation


def load_db_activities():
    """
    Loads activities.json and returns the set of valid, non-Empty activity names.
    """
    with open(ACTIVITIES_FILE, "r", encoding="utf-8") as f:
        activities_data = json.load(f)

    return set(a["name"] for a in activities_data if a.get("name") and a["name"] != "Empty")


def load_cache():
    """
    Loads the page cache that keeps repeat runs from re-fetching every agency site.
    """
    if not os.path.exists(CACHE_FILE):
        return {}
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return {}


def save_cache(cache):
    """
    Persists the page cache to disk. The cache is written to a temporary file first so an
    interrupted run can never leave a corrupt cache behind.
    """
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    temp_file = f"{CACHE_FILE}.tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(dict(cache), f, ensure_ascii=False)
    os.replace(temp_file, CACHE_FILE)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def normalize_name(name):
    """
    Normalizes a park name so Wikipedia and agency spellings can be matched. Single letter
    tokens are dropped so "Paul M. Grist State Park" matches "Paul Grist State Park".
    """
    name = name.lower()
    name = re.sub(r"\b(state|resort|recreation|historic|historical|natural|scenic|park|area|site|preserve|reserve)\b", " ", name)
    name = re.sub(r"[^a-z0-9]+", " ", name)
    return " ".join(token for token in name.split() if len(token) > 1)


def clean_park_name(name):
    """
    Removes the footnote markers Wikipedia leaves in list cells ("Miner Lake State Park [ 148 ]")
    and stray spacing after an okina ("ʻ Īao Valley" -> "ʻĪao Valley").
    """
    name = re.sub(r"(?:\s*\[[^\]]{1,8}\])+\s*$", "", name)
    name = re.sub(r"ʻ\s+", "ʻ", name)
    return " ".join(name.split())


def wikitext_to_text(wikitext):
    """
    Reduces raw wikitext to readable text so keyword detection can run against article prose.
    """
    text = re.sub(r"<ref[^>]*>.*?</ref>", " ", wikitext, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<ref[^>]*/>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\{\{cite[^{}]*\}\}", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]", r"\1", text)
    text = re.sub(r"\[(?:https?://\S+)\s+([^\]]*)\]", r"\1", text)
    text = re.sub(r"''+", "", text)
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_url(value):
    """
    Pulls an http(s) URL out of a wikitext field such as "{{URL|https://example.com}}".
    """
    if not value:
        return None
    match = re.search(r"(?:url|website|official)\s*=\s*([^\s|}]+)", value, re.IGNORECASE)
    if match:
        value = match.group(1)
    match = re.search(r"https?://[^\s|<>\[\]\"'{}]+", value)
    return match.group(0).rstrip(".,);") if match else None


def extract_infobox(wikitext):
    """
    Returns the first infobox template of an article as a {field name: raw value} dict.
    """
    match = re.search(r"\{\{\s*Infobox", wikitext)
    if not match:
        return {}

    start = match.start()
    depth = 0
    end = 0
    for index in range(start, len(wikitext) - 1):
        pair = wikitext[index : index + 2]
        if pair == "{{":
            depth += 1
        elif pair == "}}":
            depth -= 1
            if depth == 0:
                end = index + 2
                break
    if not end:
        return {}

    fields = {}
    for field in re.split(r"\n\s*\|", wikitext[start + 2 : end - 2]):
        if "=" not in field:
            continue
        key, _, value = field.partition("=")
        fields[key.strip().lower()] = value.strip()
    return fields


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
    Extracts a short, best effort entrance fee description ("$5 per vehicle") from park text.
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
# Wikipedia discovery
# ---------------------------------------------------------------------------


def get_state_list_pages():
    """
    Scrapes https://en.wikipedia.org/wiki/List_of_U.S._state_parks and returns
    {state name: list page URL} for every state with a per state park list page.
    """
    soup = soup_of(STATE_LIST_INDEX_URL, headers=WIKIPEDIA_HEADERS)
    if soup is None:
        raise RuntimeError(f"Unable to load {STATE_LIST_INDEX_URL}")

    content = soup.find("div", class_="mw-parser-output") or soup
    pages = {}
    for anchor in content.find_all("a", href=True):
        href = anchor["href"]
        label = anchor.get_text(" ", strip=True).replace("\xa0", " ")
        if "List_of_" not in href or "_state_parks" not in href or not label or ":" in label:
            continue
        pages.setdefault(label, urljoin(WIKIPEDIA_BASE, href))
    return pages


def wiki_title_from_href(href):
    """
    Converts an article href into a wiki title, ignoring non article targets. Redlinks carry a
    "?action=edit&redlink=1" query string and titles can be percent encoded, so both are cleaned
    up here.
    """
    if not href or "/wiki/" not in href:
        return None
    title = href.split("/wiki/")[-1].split("#")[0].split("?")[0]
    title = unquote(title).replace("_", " ").strip()
    if not title or title.split(":")[0] in ("File", "Category", "Help", "Portal", "Template", "Special", "Wikipedia"):
        return None
    return title


def parse_park_table(table):
    """
    Parses a single Wikipedia wikitables into park candidates. Tables listing trails,
    former parks or summary statistics are ignored.
    """
    rows = table.find_all("tr")
    if len(rows) < 2:
        return []

    headers = [cell.get_text(" ", strip=True).lower() for cell in rows[0].find_all(["th", "td"])]
    if not headers or any(word in " ".join(headers) for word in EXCLUDED_TABLE_HEADER_WORDS):
        return []

    name_columns = [index for index, header in enumerate(headers) if header.startswith(PARK_HEADER_WORDS)]
    if not name_columns:
        return []
    name_index = name_columns[0]

    parks = []
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) <= name_index:
            continue

        cell = cells[name_index]
        name = clean_park_name(cell.get_text(" ", strip=True))
        if not name or len(name) < 4 or name.lower() in EXCLUDED_ROW_NAMES:
            continue

        anchor = cell.find("a", href=True)
        title = wiki_title_from_href(anchor["href"]) if anchor else None
        if title is None and not re.search(
            r"\b(park|reserve|reservation|forest|monument|preserve|area|site|wayside|beach|springs|river|trail)\b",
            name,
            re.IGNORECASE,
        ):
            continue

        notes = " ".join(other.get_text(" ", strip=True) for other in cells)
        parks.append({"name": name, "title": title or name, "notes": notes})
    return parks


def parse_park_lists(soup):
    """
    Fallback parser for state list pages that describe their parks in bullet lists
    rather than tables (Hawaii, New Hampshire, Missouri, ...).
    """
    content = soup.find("div", class_="mw-parser-output") or soup
    parks = []
    seen = set()

    for element in content.find_all(["h2", "h3", "ul", "ol"]):
        if element.name in ("h2", "h3"):
            heading = re.sub(r"\[edit\]", "", element.get_text(" ", strip=True)).strip()
            if STOP_HEADINGS.match(heading):
                break
            continue

        for item in element.find_all("li", recursive=False):
            anchor = item.find("a", href=True)
            if anchor is None:
                continue
            title = wiki_title_from_href(anchor["href"])
            if not title or title.startswith("List of") or title in seen:
                continue

            text = item.get_text(" ", strip=True)
            if len(text) > 400 or not PARK_LIST_HINT.search(text):
                continue

            name = clean_park_name(anchor.get_text(" ", strip=True))
            if len(name) < 4:
                continue

            seen.add(title)
            parks.append({"name": name, "title": title, "notes": text})
    return parks


def scrape_state_park_list(state_name, list_url):
    """
    Collects the park candidates listed on one Wikipedia state list page.
    """
    soup = soup_of(list_url, headers=WIKIPEDIA_HEADERS)
    if soup is None:
        print(f"  ! unable to load the {state_name} list page")
        return []

    parks = []
    for table in soup.find_all("table", class_="wikitable"):
        parks.extend(parse_park_table(table))
    if not parks:
        parks = parse_park_lists(soup)

    unique = {}
    for park in parks:
        existing = unique.get(park["title"])
        if existing is None:
            unique[park["title"]] = park
        else:
            existing["notes"] = f"{existing['notes']} {park['notes']}".strip()

    print(f"  {state_name}: {len(unique)} parks listed on Wikipedia")
    return list(unique.values())


# ---------------------------------------------------------------------------
# Wikimedia API and state agency sources
# ---------------------------------------------------------------------------


def fetch_wikitext_batch(titles):
    """
    Fetches one MediaWiki API batch and returns {wiki title: wikitext}. Titles that redirect or
    are normalized also resolve to the target article. Returns None when the request failed.
    """
    response = fetch(
        WIKIPEDIA_API_URL,
        headers=WIKIPEDIA_HEADERS,
        params={
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "redirects": "1",
            "titles": "|".join(titles),
        },
    )
    if response is None:
        return None

    query = response.json().get("query", {})
    pages = {}
    for page in query.get("pages", []):
        revisions = page.get("revisions") or []
        if revisions:
            pages[page["title"]] = revisions[0]["slots"]["main"]["content"]

    for entry in (query.get("normalized") or []) + (query.get("redirects") or []):
        if entry.get("to") in pages:
            pages.setdefault(entry["from"], pages[entry["to"]])
    return pages


def fetch_wikitext(titles):
    """
    Fetches raw wikitext for many articles at once through the MediaWiki API and returns
    {wiki title: wikitext}. A batch that fails is retried title by title so one hiccup does not
    drop a whole state.
    """
    wikitext = {}
    titles = [title for title in titles if title]
    failed = []
    for start in range(0, len(titles), WIKITEXT_BATCH_SIZE):
        chunk = titles[start : start + WIKITEXT_BATCH_SIZE]
        batch = fetch_wikitext_batch(chunk)
        if batch is None:
            failed.extend(chunk)
        else:
            wikitext.update(batch)
        time.sleep(0.2)

    for title in failed:
        batch = fetch_wikitext_batch([title])
        if batch:
            wikitext.update(batch)
        time.sleep(0.1)
    return wikitext


def load_state_directory():
    """
    Loads the stateparks.org state directory and returns {state name: agency data}. The agency
    homepage is the fallback park link and the activities flag a state wide camping signal.
    """
    print(f"Fetching the state agency directory from {STATE_DIRECTORY_API}...")
    response = fetch(STATE_DIRECTORY_API, headers=BROWSER_HEADERS, extra_headers=STATE_DIRECTORY_HEADERS)
    if response is None:
        print("  ! state directory unavailable, agency links/defaults will be skipped")
        return {}

    directory = {}
    for item in response.json().get("items", []):
        data = item.get("data", {})
        state_name = data.get("stateName")
        if state_name:
            directory[state_name] = data
    print(f"  loaded {len(directory)} state agencies")
    return directory


def scrape_agency_park_list(state_name, config):
    """
    Crawls a state agency park index (e.g. https://www.alapark.com/parks) and returns
    [{"name", "link"}] for every park page it links to.
    """
    soup = soup_of(config["url"], headers=BROWSER_HEADERS)
    if soup is None:
        print(f"  ! unable to load the {state_name} agency park index")
        return []

    link_pattern = re.compile(config["link_pattern"])
    parks = []
    seen = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].split("#")[0].split("?")[0]
        if not link_pattern.match(href):
            continue

        link = urljoin(config["base"], href)
        if link in seen:
            continue

        name = anchor.get_text(" ", strip=True)
        if len(name) < 4:
            image = anchor.find("img")
            name = image["alt"].strip() if image and image.get("alt") else ""
        if len(name) < 4:
            continue

        seen.add(link)
        parks.append({"name": name, "link": link})

    print(f"  {state_name}: {len(parks)} parks linked from the agency index")
    return parks


def build_state_pattern(state_names):
    """
    Builds the regex used to find state mentions in a location field. A state only counts when
    it forms a clause of the location ("Porter County, Indiana", "Kentucky and Virginia, United
    States"), which keeps town and county names such as "Mount Washington" or "Washington
    County" from being reported as states.
    """
    names = "|".join(re.escape(name) for name in sorted(state_names, key=len, reverse=True))
    return re.compile(
        r"(?:^|,\s*|\band\s+)(" + names + r")"
        r"(?!\s*,\s*D\.?\s?C\b)"
        r"(?=\s*(?:\Z|[,;.]|\band\s+(?=" + names + r")|\bUnited States\b|\bU\.S\b))"
    )


def detect_states(text, state_pattern):
    """
    Returns the states mentioned in a location string. Mentions followed by another capitalized
    word are ignored so "Kansas City, Missouri" does not also report Kansas.
    """
    if not text:
        return set()
    return set(match.group(1) for match in state_pattern.finditer(text))


def strip_navigation(soup):
    """
    Removes scripts and site chrome (menus, headers, footers) so keyword detection only sees the
    page content. Sidebars are kept because agencies often keep fees and hours there.
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



# ---------------------------------------------------------------------------
# Park pages and record assembly
# ---------------------------------------------------------------------------


def fetch_park_page(url, cache):
    """
    Fetches a park's own page and returns the extracted text plus any reservation system links.
    The caller owns cache writes so worker threads never mutate the shared cache while it is
    being serialized. Failures are not cached so a later run can retry them.
    """
    cached = cache.get(url)
    if cached and time.time() - cached.get("fetchedAt", 0) < CACHE_TTL_SECONDS:
        return cached

    entry = {"status": None, "text": "", "reservationLinks": [], "fetchedAt": 0}
    response = fetch(url, headers=BROWSER_HEADERS)
    if response is not None:
        soup = strip_navigation(BeautifulSoup(response.text, "html.parser"))
        hrefs = [anchor["href"] for anchor in soup.find_all("a", href=True)]
        entry = {
            "status": response.status_code,
            "text": soup.get_text(" ", strip=True)[:CACHE_TEXT_LIMIT],
            "reservationLinks": [href for href in hrefs if RESERVATION_LINK_PATTERN.search(href)][:5],
            "fetchedAt": time.time(),
        }
    return entry


def build_state_records(state_name, state_id, list_url, agency_data, state_ids, state_pattern):
    """
    Builds the raw park records for one state from its Wikipedia list page and, when
    registered, its agency park index. Internal keys (prefixed with "_") are resolved later.
    """
    print(f"[{state_name}]")
    candidates = scrape_state_park_list(state_name, list_url)
    if not candidates:
        print(f"  ! no parks discovered for {state_name}")
        return []

    wikitext = fetch_wikitext([candidate["title"] for candidate in candidates])

    agency_parks = {}
    agency_config = AGENCY_PARK_LISTS.get(state_name)
    if agency_config:
        for park in scrape_agency_park_list(state_name, agency_config):
            agency_parks.setdefault(normalize_name(park["name"]), park)

    agency_url = (agency_data or {}).get("agencyUrl")
    agency_activities = (agency_data or {}).get("activities") or []
    agency_reservations = "Camping and Lodging" in agency_activities

    records = []
    matched_agency = set()
    for candidate in candidates:
        article = wikitext.get(candidate["title"], "")
        infobox = extract_infobox(article) if article else {}
        article_text = wikitext_to_text(article) if article else ""

        location_text = wikitext_to_text(
            " ".join(
                infobox.get(field, "")
                for field in ("location", "county", "counties", "nearest_city", "nearest_town")
            )
        )
        park_states = {state_name} | detect_states(location_text, state_pattern)
        record_state_ids = sorted(state_ids[name] for name in park_states if name in state_ids)

        article_url = f"{WIKIPEDIA_BASE}/wiki/{candidate['title'].replace(' ', '_')}"
        website = extract_url(infobox.get("website") or infobox.get("url") or "")
        agency_park = agency_parks.get(normalize_name(candidate["name"]))
        if agency_park:
            matched_agency.add(normalize_name(agency_park["name"]))

        # Best available park page first. The agency homepage is the last resort for the few
        # parks that have no article of their own to link to.
        if agency_park:
            link = agency_park["link"]
        elif website:
            link = website
        elif article:
            link = article_url
        else:
            link = agency_url or article_url

        records.append(
            {
                "stateId": state_id,
                "name": candidate["name"],
                "link": link,
                "reservationAvailable": agency_reservations,
                "entryFee": None,
                "permitRequired": None,
                "activities": [],
                "_stateIds": record_state_ids or [state_id],
                "_notes": candidate["notes"],
                "_text": article_text,
                "_linkIsExternal": not link.startswith(WIKIPEDIA_BASE),
            }
        )

    # Agency parks that the Wikipedia list does not cover (new or renamed parks).
    for name, park in agency_parks.items():
        if name in matched_agency:
            continue
        records.append(
            {
                "stateId": state_id,
                "name": park["name"],
                "link": park["link"],
                "reservationAvailable": agency_reservations,
                "entryFee": None,
                "permitRequired": None,
                "activities": [],
                "_stateIds": [state_id],
                "_notes": "",
                "_text": "",
                "_linkIsExternal": True,
            }
        )

    print(f"  {state_name}: {len(records)} park records ({len(agency_parks)} from the agency index)")
    return records


def finalize_record(record, page_entry, db_activities):
    """
    Merges the park page signals into a record, maps activities onto data/activities.json and
    drops the internal keys. Falls back to the state wide agency signal when a park page could
    not be read.
    """
    page_text = page_entry.get("text", "") if page_entry else ""
    reservation_links = page_entry.get("reservationLinks", []) if page_entry else []

    activities = detect_activities(record["_notes"], record["_text"], page_text)
    record["activities"] = [name for name in activities if name in db_activities]

    record["reservationAvailable"] = bool(
        detect_reservation(page_text, reservation_links)
        or detect_reservation(record["_text"], [])
        or record["reservationAvailable"]
    )
    record["entryFee"] = detect_entry_fee(page_text) or detect_entry_fee(record["_text"])
    record["permitRequired"] = detect_permit(page_text) or detect_permit(record["_text"])

    for key in [key for key in record if key.startswith("_")]:
        del record[key]
    return record


def enrich_records(records, cache, skip_details):
    """
    Fetches every distinct external park page once (in parallel, cached between runs) and
    returns {url: page entry} so records sharing a link reuse the same result.
    """
    urls = sorted({record["link"] for record in records if record["_linkIsExternal"]})
    if skip_details or not urls:
        print(f"Skipping park page details for {len(urls)} external links")
        return {}

    print(f"Fetching {len(urls)} park pages for reservation/fee/permit signals...")
    pages = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for index, (url, entry) in enumerate(
            pool.map(lambda page_url: (page_url, fetch_park_page(page_url, cache)), urls), start=1
        ):
            pages[url] = entry
            cache[url] = entry
            if entry["status"] != 200:
                print(f"  ! [{index}/{len(urls)}] {entry['status']} {url}")
            elif index % 100 == 0 or index == len(urls):
                print(f"  ...{index}/{len(urls)} park pages fetched")
            if index % 100 == 0:
                save_cache(cache)
    return pages


def print_summary(records):
    """
    Logs coverage per source so gaps in the data are obvious.
    """
    states = {record["stateId"] for record in records}
    websites = [record for record in records if not record["link"].startswith(WIKIPEDIA_BASE)]
    print("\nSummary")
    print(f"  states:               {len(states)}")
    print(f"  parks:                {len(records)}")
    print(f"  parks with a website: {len(websites)}")
    print(f"  reservationAvailable: {sum(1 for record in records if record['reservationAvailable'])}")
    print(f"  entryFee detected:    {sum(1 for record in records if record['entryFee'])}")
    print(f"  permitRequired:       {sum(1 for record in records if record['permitRequired'])}")
    print(f"  activities detected:  {sum(1 for record in records if record['activities'])}")


def parse_state_filter(values, by_abbreviation):
    """
    Turns ["AL", "Maine"] into {"Alabama", "Maine"}.
    """
    if not values:
        return None

    selected = set()
    for value in values:
        value = value.strip()
        if not value:
            continue
        if value in by_abbreviation.values():
            selected.add(value)
        elif value.upper() in by_abbreviation:
            selected.add(by_abbreviation[value.upper()])
        else:
            print(f"Unknown state '{value}', skipping")
    return selected


def scrape_all_parks(state_filter=None, skip_details=False, output_file=OUTPUT_FILE):
    """
    Runs the full pipeline and writes the park records to output_file.
    """
    state_ids, _ = load_states()
    db_activities = load_db_activities()
    state_directory = load_state_directory()
    list_pages = get_state_list_pages()
    state_pattern = build_state_pattern(state_ids.keys())
    print(f"Discovered {len(list_pages)} Wikipedia state park list pages")

    selected = [
        state_name
        for state_name, _ in sorted(list_pages.items(), key=lambda item: state_ids.get(item[0], 0))
        if (not state_filter or state_name in state_filter) and state_name in state_ids
    ]
    skipped = sorted(set(state_filter or list_pages) - set(selected))
    if skipped:
        print(f"Skipping states without a list page or stateId: {', '.join(skipped)}")

    records = []
    for state_name in selected:
        records.extend(
            build_state_records(
                state_name,
                state_ids[state_name],
                list_pages[state_name],
                state_directory.get(state_name),
                state_ids,
                state_pattern,
            )
        )

    cache = load_cache()
    pages = enrich_records(records, cache, skip_details)
    save_cache(cache)

    results = []
    seen = set()
    for record in records:
        for state_id in record["_stateIds"]:
            expanded = dict(record)
            expanded["stateId"] = state_id
            finalized = finalize_record(expanded, pages.get(record["link"]), db_activities)
            key = (finalized["stateId"], normalize_name(finalized["name"]))
            if key in seen:
                continue
            seen.add(key)
            results.append(finalized)

    results.sort(key=lambda record: (record["stateId"], record["name"]))
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print_summary(results)
    print(f"\nSuccessfully wrote {len(results)} state park records to {output_file}")


def main():
    """
    Parses the command line options and runs the scraper.
    """
    parser = argparse.ArgumentParser(description="Scrape individual U.S. state parks into data/stateParks/stateParks.json")
    parser.add_argument("--states", help="comma separated state names or abbreviations (default: all)")
    parser.add_argument(
        "--skip-details",
        action="store_true",
        help="skip fetching park pages for reservation/entry fee/permit details",
    )
    parser.add_argument("--output", default=OUTPUT_FILE, help=f"output file (default: {OUTPUT_FILE})")
    args = parser.parse_args()

    _, by_abbreviation = load_states()
    state_filter = parse_state_filter(args.states.split(",") if args.states else None, by_abbreviation)
    scrape_all_parks(state_filter=state_filter, skip_details=args.skip_details, output_file=args.output)


if __name__ == "__main__":
    main()




