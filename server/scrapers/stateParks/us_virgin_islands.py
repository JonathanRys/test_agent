"""
Scrapes the US Virgin Islands state parks list at https://dpnr.vi.gov/parks/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
dpnr.vi.gov/parks/ lists the territory's parks as /parks/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes US Virgin Islands' agency.

Usage
-----
    .venv/bin/python stateParks/us_virgin_islands.py
    .venv/bin/python stateParks/us_virgin_islands.py --skip-details
    .venv/bin/python stateParks/us_virgin_islands.py --output /tmp/us_virgin_islands.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "US Virgin Islands",
    "abbr": "VI",
    "list_url": "https://dpnr.vi.gov/parks/",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the US Virgin Islands scrape and writes data/stateParks/usvirginislandsParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
