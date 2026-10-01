"""
Scrapes the Kentucky state parks list at https://parks.ky.gov/explore and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
Kentucky park pages live at /explore/<slug>-<id>; the Explore page renders its
grid client side, so until it is server rendered this config returns no parks
rather than failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Kentucky's agency.

Usage
-----
    .venv/bin/python stateParks/kentucky.py
    .venv/bin/python stateParks/kentucky.py --skip-details
    .venv/bin/python stateParks/kentucky.py --output /tmp/kentucky.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Kentucky",
    "abbr": "KY",
    "list_url": "https://parks.ky.gov/explore",
    "park_path_pattern": r"^/explore/[^/]+/?$",
}


def main():
    """
    Runs the Kentucky scrape and writes data/stateParks/kentuckyParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
