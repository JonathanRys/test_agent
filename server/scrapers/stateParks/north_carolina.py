"""
Scrapes the North Carolina state parks list at https://www.ncparks.gov/state-parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
ncparks.gov/state-parks lists every park and state recreation area as
/state-parks/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes North Carolina's agency.

Usage
-----
    .venv/bin/python stateParks/north_carolina.py
    .venv/bin/python stateParks/north_carolina.py --skip-details
    .venv/bin/python stateParks/north_carolina.py --output /tmp/north_carolina.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "North Carolina",
    "abbr": "NC",
    "list_url": "https://www.ncparks.gov/state-parks",
    "park_path_pattern": r"^/state-parks/[^/]+/?$",
}


def main():
    """
    Runs the North Carolina scrape and writes data/stateParks/northcarolinaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
