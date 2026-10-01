"""
Scrapes the Oklahoma state parks list at https://www.travelok.com/state-parks/search and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
travelok.com/state-parks/search lists every state park as a travel listing
(/listings/view.profile/id.NNN).

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Oklahoma's agency.

Usage
-----
    .venv/bin/python stateParks/oklahoma.py
    .venv/bin/python stateParks/oklahoma.py --skip-details
    .venv/bin/python stateParks/oklahoma.py --output /tmp/oklahoma.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Oklahoma",
    "abbr": "OK",
    "list_url": "https://www.travelok.com/state-parks/search",
    "park_path_pattern": r"^/listings/view\.profile/id\.\d+$",
}


def main():
    """
    Runs the Oklahoma scrape and writes data/stateParks/oklahomaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
