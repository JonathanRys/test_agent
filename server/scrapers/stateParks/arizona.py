"""
Scrapes the Arizona state parks list at https://azstateparks.com/find-a-park and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
Every park page sits at the site root (/alamo-lake) and the find-a-park page links
all of them next to the site navigation, so name_from keeps only unit names (those
carrying a 'State Park/Historic Site/Recreation Area' type word).

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Arizona's agency.

Usage
-----
    .venv/bin/python stateParks/arizona.py
    .venv/bin/python stateParks/arizona.py --skip-details
    .venv/bin/python stateParks/arizona.py --output /tmp/arizona.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

UNIT_NAME_PATTERN = re.compile(
    r"(?i)state (?:park|historic park|historic site|historic monument|recreation area|"
    r"natural area|preserve)|state park$|recreation area$"
)


def unit_name(text, href):
    """
    Park card text on azstateparks.com ("Alamo Lake State Park") is kept; the site
    navigation that also sits at the root ("Reservations") is dropped.
    """
    return text if UNIT_NAME_PATTERN.search(text) else ""

CONFIG = {
    "state": "Arizona",
    "abbr": "AZ",
    "list_url": "https://azstateparks.com/find-a-park",
    "park_path_pattern": r"^/[^/]+/?$",
    "name_from": unit_name,
    # The list page links itself (/find-a-park) and a non-park board page next to
    # the unit links; both are excluded. Every park unit sits at the site root.
    "exclude_slugs": {"find-a-park", "arizona-state-parks-board"},
    # Arizona campsites live behind the /reserve Usedirect widget, which is a
    # single-page app: mining park-page links only yields promo text, so
    # campgrounds come from its reservation API instead (see
    # utils.collect_usedirect_campgrounds).
    "campground_links": False,
    "usedirect": {
        "base_url": "https://azrdr.usedirect.com/azrdr/rdr",
        # Match each facility's place back to the park list so campground
        # records link the park page, not the /reserve widget.
        "match_parks": True,
        # "Cabins", "Lodge", ... belong to these places; skip them in full.
        "exclude_places": {18, 24},
    },
}


def main():
    """
    Runs the Arizona scrape and writes data/stateParks/arizonaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
