"""
Scrapes the South Dakota state parks list at https://gfp.sd.gov/parks/findpark/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
gfp.sd.gov/parks/findpark lists every park and use area as
/parks/detail/<Name>; the anchor text is the park name.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes South Dakota's agency.

Usage
-----
    .venv/bin/python stateParks/south_dakota.py
    .venv/bin/python stateParks/south_dakota.py --skip-details
    .venv/bin/python stateParks/south_dakota.py --output /tmp/south_dakota.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "South Dakota",
    "abbr": "SD",
    "list_url": "https://gfp.sd.gov/parks/findpark/",
    "park_path_pattern": r"^/parks/detail/[^/]+/?$",
}


def main():
    """
    Runs the South Dakota scrape and writes data/stateParks/southdakotaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
