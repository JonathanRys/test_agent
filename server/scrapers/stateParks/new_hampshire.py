"""
Scrapes the New Hampshire state parks list at https://www.nhstateparks.org/parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
nhstateparks.org serves every park as /parks/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes New Hampshire's agency.

Usage
-----
    .venv/bin/python stateParks/new_hampshire.py
    .venv/bin/python stateParks/new_hampshire.py --skip-details
    .venv/bin/python stateParks/new_hampshire.py --output /tmp/new_hampshire.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "New Hampshire",
    "abbr": "NH",
    "list_url": "https://www.nhstateparks.org/parks",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the New Hampshire scrape and writes data/stateParks/newhampshireParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
