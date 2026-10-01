"""
Scrapes the Idaho state parks list at https://parksandrecreation.idaho.gov/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
Idaho's park finder is a client rendered map, so the sitemap index is used: its
state-park-sitemap.xml child lists every /state-park/<slug> page.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Idaho's agency.

Usage
-----
    .venv/bin/python stateParks/idaho.py
    .venv/bin/python stateParks/idaho.py --skip-details
    .venv/bin/python stateParks/idaho.py --output /tmp/idaho.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Idaho",
    "abbr": "ID",
    "list_url": "https://parksandrecreation.idaho.gov/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/state-park/[^/]+/?$",
}


def main():
    """
    Runs the Idaho scrape and writes data/stateParks/idahoParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
