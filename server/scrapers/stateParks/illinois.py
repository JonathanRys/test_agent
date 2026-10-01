"""
Scrapes the Illinois state parks list at https://dnr.illinois.gov/parks/allparks.html and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
dnr.illinois.gov/parks/allparks.html only links the five region pages, and both
the hub and the region pages render their park lists client side, so the
config targets the park page shape (/parks/park.html?id=N) and currently returns
no parks until the site server renders its list.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Illinois' agency.

Usage
-----
    .venv/bin/python stateParks/illinois.py
    .venv/bin/python stateParks/illinois.py --skip-details
    .venv/bin/python stateParks/illinois.py --output /tmp/illinois.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Illinois",
    "abbr": "IL",
    "list_url": "https://dnr.illinois.gov/parks/allparks.html",
    "park_path_pattern": r"^/?(?:parks/)?park\.html\?id=\d+$",
}


def main():
    """
    Runs the Illinois scrape and writes data/stateParks/illinoisParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
