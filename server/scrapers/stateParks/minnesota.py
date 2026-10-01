"""
Scrapes the Minnesota state parks list at https://www.dnr.state.mn.us/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
Minnesota park pages are query URLs (/state_parks/park.html?id=spkNNNNN) and the
index page renders client side, so parse_list reads the park ids from the DNR
sitemap and takes each park's name from its page title (fetched through the
shared cache, so the detail pass reuses it).

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Minnesota's agency.

Usage
-----
    .venv/bin/python stateParks/minnesota.py
    .venv/bin/python stateParks/minnesota.py --skip-details
    .venv/bin/python stateParks/minnesota.py --output /tmp/minnesota.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

PARK_ID_PATTERN = re.compile(r"(?:^|[?&])id=spk\d+$")


def parse_parks(soup, config, state_id):
    """
    Collects the /state_parks/park.html?id=spkNNNNN links from the sitemap (following
    child sitemaps) and names each park from its page title.
    """
    cache = config.get("_cache") or {}
    parks = []
    seen = set()
    for loc in soup.find_all("loc"):
        href = loc.get_text(strip=True)
        if not href:
            continue
        if re.search(r"sitemap[^/]*\.xml$", urlparse(href).path, re.IGNORECASE):
            child = utils.fetch(href)
            if child is not None:
                parks.extend(
                    parse_parks(BeautifulSoup(child.text, "html.parser"), config, state_id)
                )
            continue
        if not re.match(config["park_path_pattern"], urlparse(href).path):
            continue
        if not PARK_ID_PATTERN.search(urlparse(href).query):
            continue
        if href in seen:
            continue
        seen.add(href)

        entry = utils.fetch_page(href, cache)
        text = entry.get("text", "")
        # A park page starts with its title: "Park Name | Minnesota DNR" or
        # "Park Name - Minnesota DNR".
        name = re.split(r"\s*[|–—-]\s*", text, 1)[0].strip() if text else ""
        if not name:
            continue
        parks.append({"stateId": state_id, "name": name[:120], "link": href})
    return parks

CONFIG = {
    "state": "Minnesota",
    "abbr": "MN",
    "list_url": "https://www.dnr.state.mn.us/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/state_parks/park\.html$",
    "parse_list": parse_parks,
}


def main():
    """
    Runs the Minnesota scrape and writes data/stateParks/minnesotaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
