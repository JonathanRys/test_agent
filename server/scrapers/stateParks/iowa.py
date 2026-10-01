"""
Scrapes the Iowa state parks list at https://www.iowadnr.gov/places-go/state-parks/all-parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
iowadnr.gov/places-go/state-parks/all-parks lists every park at
/places-go/state-parks/all-parks/<slug> (the park cards render client side, so
the site's own /places-go/state-parks section is used as the anchor list).

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Iowa's agency.

Usage
-----
    .venv/bin/python stateParks/iowa.py
    .venv/bin/python stateParks/iowa.py --skip-details
    .venv/bin/python stateParks/iowa.py --output /tmp/iowa.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Iowa",
    "abbr": "IA",
    "list_url": "https://www.iowadnr.gov/places-go/state-parks/all-parks",
    "park_path_pattern": r"^/places-go/state-parks/all-parks/[^/]+/?$",
}


def main():
    """
    Runs the Iowa scrape and writes data/stateParks/iowaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
