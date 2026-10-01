"""
Scrapes the Michigan state parks list at https://www.michigan.gov/dnr/places/state-parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
michigan.gov/dnr/places/state-parks is the DNR parks hub; park pages live at
/dnr/places/state-parks/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Michigan's agency.

Usage
-----
    .venv/bin/python stateParks/michigan.py
    .venv/bin/python stateParks/michigan.py --skip-details
    .venv/bin/python stateParks/michigan.py --output /tmp/michigan.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Michigan",
    "abbr": "MI",
    "list_url": "https://www.michigan.gov/dnr/places/state-parks",
    "park_path_pattern": r"^/dnr/places/state-parks/[^/]+/?$",
}


def main():
    """
    Runs the Michigan scrape and writes data/stateParks/michiganParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
