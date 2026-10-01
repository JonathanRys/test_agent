"""
Scrapes the Montana state parks list at https://fwp.mt.gov/stateparks/find-a-park and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
fwp.mt.gov/stateparks/find-a-park lists every park as /stateparks/<slug>. The card
text wraps the name in chrome ('State Parks Makoshika Visit Makoshika >'), so
name_from keeps only the park name and drops the section links (which share the
same URL prefix).

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Montana's agency.

Usage
-----
    .venv/bin/python stateParks/montana.py
    .venv/bin/python stateParks/montana.py --skip-details
    .venv/bin/python stateParks/montana.py --output /tmp/montana.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CARD_PATTERN = re.compile(r"^State Parks\s+(.+?)\s+Visit\b", re.IGNORECASE)


def park_name(text, href):
    """
    "State Parks Makoshika Visit Makoshika >" -> "Makoshika"; plain card text
    ("Ackley Lake") is used as is. The section links that share the URL prefix are
    removed by exclude_slugs instead.
    """
    match = CARD_PATTERN.match(text.strip())
    return match.group(1).strip() if match else text.strip()

CONFIG = {
    "state": "Montana",
    "abbr": "MT",
    "list_url": "https://fwp.mt.gov/stateparks/find-a-park",
    "park_path_pattern": r"^/stateparks/[^/]+/?$",
    "name_from": park_name,
    "exclude_slugs": {"find-a-park", "park-activities", "education-resources",
                      "fees-and-general-information", "meets-our-employees",
                      "park-conditions", "contacts", "volunteers"},
}


def main():
    """
    Runs the Montana scrape and writes data/stateParks/montanaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
