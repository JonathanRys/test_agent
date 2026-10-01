"""
Scrapes the Nevada state parks list at https://parks.nv.gov/parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
parks.nv.gov/parks lists every park and recreation area as /parks/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Nevada's agency.

Usage
-----
    .venv/bin/python stateParks/nevada.py
    .venv/bin/python stateParks/nevada.py --skip-details
    .venv/bin/python stateParks/nevada.py --output /tmp/nevada.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Nevada",
    "abbr": "NV",
    "list_url": "https://parks.nv.gov/parks",
    "park_path_pattern": r"^/parks/[^/]+/?$",
    "exclude_slugs": {"neweststatepark"},
}


def main():
    """
    Runs the Nevada scrape and writes data/stateParks/nevadaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
