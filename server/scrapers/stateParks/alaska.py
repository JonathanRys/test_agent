"""
Scrapes the Alaska state parks list at https://dnr.alaska.gov/parks/aspunits/index.htm and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
dnr.alaska.gov's 'List of Units' (parks/parkunits.htm) covers most units, but
the regional pages hang the full set off /parks/aspunits/<region>/<unit>.htm
(the unit list omits ~21 pages, several of them campgrounds), so parse_list
crawls the region index pages for a complete unit list. Campgrounds are then
split into alaska_campgrounds.json using the site's own campground list
(parks/units/campsitelist.htm) plus campground_pattern for the campground
pages that list omits. A unit in both lists keeps the fuller unit name and is
written once, as a campground; the region *index.htm pages are excluded.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Alaska's agency.

Usage
-----
    .venv/bin/python stateParks/alaska.py
    .venv/bin/python stateParks/alaska.py --skip-details
    .venv/bin/python stateParks/alaska.py --output /tmp/alaska.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

REGION_INDEX_PATTERN = re.compile(r"^/parks/aspunits/[^/]+/[a-z0-9]+index\.s?html?$")


def parse_parks(soup, config, state_id):
    """
    The parks index only links the region pages, and each region page lists its
    unit pages as bare slugs ("eaglerivercamp.htm"), so this crawls the regions and
    returns one record per unit page.
    """
    base = config["list_url"]
    cache = config.get("_cache") or {}
    regions = []
    seen_regions = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not REGION_INDEX_PATTERN.match(href):
            continue
        url = urljoin(base, href)
        if url in seen_regions:
            continue
        seen_regions.add(url)
        regions.append(url)

    parks = []
    seen = set()
    for region_url in regions:
        # Cached like the island pages elsewhere: region pages should not be
        # re-downloaded on every run.
        entry = utils.fetch_list_html(region_url, cache)
        if entry.get("status") != 200 or not entry.get("html"):
            print(f"  ! region page unavailable: {region_url}")
            continue
        cache[region_url] = entry
        region_soup = BeautifulSoup(entry["html"], "html.parser")
        for anchor in region_soup.find_all("a", href=True):
            href = anchor["href"].strip()
            # Region pages link with bare slugs, so match the joined path.
            link = urljoin(region_url, href)
            if not re.match(config["park_path_pattern"], urlparse(link).path):
                continue
            if link in seen:
                continue
            name = anchor.get_text(" ", strip=True)
            if not name:
                continue
            seen.add(link)
            parks.append({"stateId": state_id, "name": utils.clean_park_name(name), "link": link})
    return parks

CONFIG = {
    "state": "Alaska",
    "abbr": "AK",
    "list_url": "https://dnr.alaska.gov/parks/aspunits/index.htm",
    "campground_list_url": "https://dnr.alaska.gov/parks/units/campsitelist.htm",
    "campground_pattern": r"(?i)camp\.s?html?$",
    "park_path_pattern": r"^/parks/aspunits/[^/]+/(?!.*index)[^/]+\.s?html?$",
    "parse_list": parse_parks,
}


def main():
    """
    Runs the Alaska scrape and writes data/stateParks/alaskaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
