"""
Scrapes the Colorado state parks list at https://cpw.state.co.us/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
The State Park Finder page renders client side, but the sitemap index (three
child sitemaps) lists every /state-parks/<slug> page, so list_kind=sitemap is used
and utils follows the child sitemaps.

The /camping landing page ("Campgrounds, Cabins and Yurts") links no campground
pages at all - booking goes through cpwshop.com - so the campground index is
the sitemap as well: every /state-parks/<park>/<...camp...> child page is that
park's own camping page (the park pages link it from their tab bar). Those tab
links sit in a nav-stripped accordion, so the mining pass cannot see them, and
the sitemap covers all of them deterministically.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Colorado's agency.

Usage
-----
    .venv/bin/python stateParks/colorado.py
    .venv/bin/python stateParks/colorado.py --skip-details
    .venv/bin/python stateParks/colorado.py --output /tmp/colorado.json
"""
import os
import sys

import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

# A camping page sits one level under its park: /state-parks/<park>/<park>-camping-lodging
CAMPGROUND_CHILD_PATTERN = re.compile(r"^/state-parks/[^/]+/[^/]*camp[^/]*$", re.IGNORECASE)


def parse_camping_list(soup, config, state_id):
    """
    Reads the sitemap's camping child pages. The index only lists the child
    sitemaps, so they are fetched (through the shared cache) and scanned for
    /state-parks/<park>/<...camp...> URLs; each record is named after its park.
    """
    cache = config.get("_cache") or {}
    locs = [loc.get_text(strip=True) for loc in soup.select("loc")]
    children = [loc for loc in locs if re.search(r"/sitemap\.xml(?:\?page=\d+)?$", loc)]
    if children:
        locs = []
        for child in children:
            entry = utils.fetch_list_html(child, cache)
            if entry.get("status") != 200 or not entry.get("html"):
                print(f"  ! campground sitemap unavailable: {child}")
                continue
            child_soup = BeautifulSoup(entry["html"], "html.parser")
            locs.extend(loc.get_text(strip=True) for loc in child_soup.select("loc"))

    records = []
    seen = set()
    for loc in locs:
        path = urlparse(loc).path
        if not CAMPGROUND_CHILD_PATTERN.match(path):
            continue
        link = loc.split("?")[0]
        if link in seen:
            continue
        seen.add(link)
        park_segment = path.split("/")[2]
        name = f"{utils.slug_to_name('/' + park_segment)} Campground"
        records.append({"stateId": state_id, "name": name, "link": link})
    return records


CONFIG = {
    "state": "Colorado",
    "abbr": "CO",
    "list_url": "https://cpw.state.co.us/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/state-parks/[^/]+/?$",
    "campground_list_url": "https://cpw.state.co.us/sitemap.xml",
    "campground_parse_list": parse_camping_list,
}


def main():
    """
    Runs the Colorado scrape and writes data/stateParks/coloradoParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
