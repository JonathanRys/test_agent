"""
Scrapes the Vermont state parks list at https://www.vtstateparks.com/park-finder and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
vtstateparks.com/park-finder lists every park as /parks/<slug>; the anchor text
is the park name.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Vermont's agency.

Usage
-----
    .venv/bin/python stateParks/vermont.py
    .venv/bin/python stateParks/vermont.py --skip-details
    .venv/bin/python stateParks/vermont.py --output /tmp/vermont.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Vermont",
    "abbr": "VT",
    "list_url": "https://www.vtstateparks.com/park-finder",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the Vermont scrape and writes data/stateParks/vermontParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
