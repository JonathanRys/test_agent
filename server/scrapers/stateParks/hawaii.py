"""
Scrapes the Hawaii state parks list at https://dlnr.hawaii.gov/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
The Division of State Parks index is per island (/dsp/parks/<island>/), so
parse_list visits the four island pages and keeps their
/dsp/parks/<island>/<park> links.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Hawaii's agency.

Usage
-----
    .venv/bin/python stateParks/hawaii.py
    .venv/bin/python stateParks/hawaii.py --skip-details
    .venv/bin/python stateParks/hawaii.py --output /tmp/hawaii.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

ISLANDS = ("oahu", "maui", "hawaii", "kauai")


def parse_parks(soup, config, state_id):
    """
    Visits each island page (/dsp/parks/<island>/) and returns one record per park
    link; the anchor text is the park name.
    """
    parks = []
    seen = set()
    cache = config.get("_cache") or {}
    for island in ISLANDS:
        island_url = urljoin(config["list_url"], f"dsp/parks/{island}/")
        # Go through the shared page cache: dlnr.hawaii.gov rate-limits quickly, so
        # the island pages must not be re-downloaded on every run.
        entry = utils.fetch_list_html(island_url, cache)
        if entry.get("status") != 200 or not entry.get("html"):
            print(f"  ! island page unavailable: {island_url}")
            continue
        cache[island_url] = entry
        island_soup = BeautifulSoup(entry["html"], "html.parser")
        for anchor in island_soup.find_all("a", href=True):
            href = anchor["href"].strip()
            # Island pages link with bare slugs ("kokee-state-park"), so the
            # pattern is matched against the joined path.
            link = urljoin(island_url, href).rstrip("/")
            if not re.match(config["park_path_pattern"], urlparse(link).path):
                continue
            if link in seen:
                continue
            name = anchor.get_text(" ", strip=True)
            if not name:
                continue
            seen.add(link)
            parks.append({"stateId": state_id, "name": name, "link": link})
    return parks

CONFIG = {
    "state": "Hawaii",
    "abbr": "HI",
    "list_url": "https://dlnr.hawaii.gov/",
    "park_path_pattern": r"^/dsp/parks/[^/]+/[^/]+/?$",
    "parse_list": parse_parks,
}


def main():
    """
    Runs the Hawaii scrape and writes data/stateParks/hawaiiParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
