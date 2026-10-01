"""
Scrapes the Kansas state parks list at https://www.ksoutdoors.com/State-Parks/Locations and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
ksoutdoors.com/State-Parks/Locations lists every park under its own path,
/State-Parks/Locations/<name>. The site answers 403 to scrapers (bot
protection), so the scraper still runs and reports the block instead of failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Kansas' agency.

Usage
-----
    .venv/bin/python stateParks/kansas.py
    .venv/bin/python stateParks/kansas.py --skip-details
    .venv/bin/python stateParks/kansas.py --output /tmp/kansas.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Kansas",
    "abbr": "KS",
    "list_url": "https://www.ksoutdoors.com/State-Parks/Locations",
    "park_path_pattern": r"^/State-Parks/Locations/[^/]+/?$",
}


def main():
    """
    Runs the Kansas scrape and writes data/stateParks/kansasParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
