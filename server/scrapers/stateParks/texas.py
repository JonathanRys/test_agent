"""
Scrapes the Texas state parks list at https://tpwd.texas.gov/state-parks/parks-map and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
tpwd.texas.gov/state-parks/parks-map links every park as /state-parks/<slug>.
The link text carries the park name followed by its nearest town and state
('Ray Roberts Lake State Park Pilot Point, TX'), so name_from keeps the park
name and drops the trailing location.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Texas' agency.

Usage
-----
    .venv/bin/python stateParks/texas.py
    .venv/bin/python stateParks/texas.py --skip-details
    .venv/bin/python stateParks/texas.py --output /tmp/texas.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

LOCATION_SUFFIX_PATTERN = re.compile(r"\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2}\b")


def park_name(text, href):
    """
    "Ray Roberts Lake State Park Pilot Point, TX" -> "Ray Roberts Lake State Park".
    """
    return LOCATION_SUFFIX_PATTERN.split(text.strip())[0].strip()

CONFIG = {
    "state": "Texas",
    "abbr": "TX",
    "list_url": "https://tpwd.texas.gov/state-parks/parks-map",
    "park_path_pattern": r"^/state-parks/[^/]+/?$",
    "name_from": park_name,
}


def main():
    """
    Runs the Texas scrape and writes data/stateParks/texasParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
