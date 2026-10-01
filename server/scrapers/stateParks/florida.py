"""
Scrapes the Florida state parks list at https://www.floridastateparks.org/parks-and-trails and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
The list view renders one a.card__link per unit; the anchor's title attribute
holds the unit name while the card text adds a summary and address, so
parse_parks reads cards only. Cards link two shapes - the current
/parks-and-trails/<slug> pages and legacy root pages (/Alafia) the site still
uses - so the pattern accepts both and records are deduped by name as well as
by link, because the same park can appear under either shape while the site
migrates its URLs.

The camping index is the same view filtered to experiences:Camping
(?parks[0]=experiences:242): it repeats the park pages for the units that take
campers, so campgrounds_shared_with_parks keeps them in the parks file and adds
them to the campground file too. The archive never captured that filter's last
pager page, so parse_camping_list finishes the list from the park pages in the
cache: a park whose experiences field names camping takes campers.

The whole site sits behind a Cloudflare WAF that answers 403 to datacenter
IPs (every path, including the front page), so live runs cannot fetch the list;
the page cache is seeded from Wayback Machine snapshots of the list pages and
their "?page=N" pager, which lets the list runs offline. Detail fields stay
blank until the block clears - the same handling as other blocked agencies.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Florida's agency.

Usage
-----
    .venv/bin/python stateParks/florida.py --skip-details
    .venv/bin/python stateParks/florida.py --output /tmp/florida.json
"""
import os
import sys

import re
import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

LIST_URL = "https://www.floridastateparks.org/parks-and-trails"
CAMPING_FACET = "parks%5B0%5D=experiences%3A242"
CAMPING_INDEX_URL = f"{LIST_URL}?{CAMPING_FACET}"
# A park page lists its experiences as anchors, so "camping" there is the same
# signal the filtered index uses (experiences:Camping).
CAMPING_EXPERIENCE = re.compile(r'<a\s+name="camping"')

# Cards link a /parks-and-trails/<slug> page, a legacy root page (/Alafia), and
# in older Drupal snapshots both of those behind an /index.php path prefix.
CARD_PATH_PATTERN = r"^/(?:index\.php/)?(?:parks-and-trails/)?[A-Za-z0-9][A-Za-z0-9-]*/?$"
INDEX_PHP_PREFIX = re.compile(r"^(https://www\.floridastateparks\.org)/index\.php(/.*)?$")


def parse_parks(soup, config, state_id):
    """
    Turns each list-view card into a record: link from the anchor, name from
    its title attribute (falling back to the card heading). Used for both the
    park list and the camping-filtered index.
    """
    pattern = config["park_path_pattern"]
    records = []
    seen_links = set()
    seen_names = set()
    for anchor in soup.select("a.card__link[href]"):
        href = anchor["href"].strip()
        if not re.match(pattern, href) or href.rstrip("/") == "/parks-and-trails":
            continue
        name = utils.clean_park_name(anchor.get("title") or "")
        if not name:
            title = anchor.select_one(".card__title")
            name = utils.clean_park_name(title.get_text(" ", strip=True)) if title else ""
        if not name:
            continue
        link = urljoin(config["list_url"], href)
        # Older snapshots emit the Drupal /index.php/ prefix; the canonical park
        # page is the same park without it.
        link = INDEX_PHP_PREFIX.sub(r"\1\2", link).rstrip("/")
        # The same park can be listed under its new and its legacy URL while
        # the site migrates, so a repeated name is the same park.
        key = name.casefold()
        if link in seen_links or key in seen_names:
            continue
        seen_links.add(link)
        seen_names.add(key)
        records.append({"stateId": state_id, "name": name, "link": link})
    return records


def parse_camping_list(soup, config, state_id):
    """
    Camping records come from the cards of the filtered index. The filter's last
    page was never captured by the archive the blocked site is seeded from, so
    the tail of the list is recovered from the park pages themselves: a park
    whose experiences field lists camping (the anchor FL renders as
    <a name="camping">) takes campers. Park pages are read from the page cache
    only, so once the site answers the scraper again the index pages alone
    decide the list.
    """
    records = parse_parks(soup, config, state_id)
    seen = {record["name"].casefold() for record in records}
    cache = config.get("_cache") or {}
    if not cache:
        return records

    list_config = dict(config)
    list_config["list_url"] = LIST_URL
    for _page_url, entry in utils.collect_list_html(LIST_URL, list_config, cache):
        if entry.get("status") != 200 or not entry.get("html"):
            continue
        for park in parse_parks(BeautifulSoup(entry["html"], "html.parser"), list_config, state_id):
            if park["name"].casefold() in seen:
                continue
            page = cache.get(park["link"]) or {}
            if not page.get("html") or time.time() - page.get("fetchedAt", 0) >= utils.CACHE_TTL_SECONDS:
                continue
            if not CAMPING_EXPERIENCE.search(page["html"]):
                continue
            seen.add(park["name"].casefold())
            records.append(park)
    return records


CONFIG = {
    "state": "Florida",
    "abbr": "FL",
    "list_url": LIST_URL,
    "park_path_pattern": CARD_PATH_PATTERN,
    "parse_list": parse_parks,
    # Thirteen "?page=N" view pages carry the full list; the camping index has
    # four, and the pager stops itself, so one shared cap covers both.
    "list_page_limit": 15,
    "campground_list_url": CAMPING_INDEX_URL,
    "campground_path_pattern": CARD_PATH_PATTERN,
    "campground_parse_list": parse_camping_list,
    "campgrounds_shared_with_parks": True,
}


def main():
    """
    Runs the Florida scrape and writes data/stateParks/floridaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()