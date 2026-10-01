"""
Scrapes the Rhode Island state parks list at https://riparks.ri.gov/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
riparks.ri.gov serves every state park as /details/<slug>. The site answers 403
to scrapers (Cloudflare), so the scraper still runs and reports the block
instead of failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Rhode Island's agency.

Usage
-----
    .venv/bin/python stateParks/rhode_island.py
    .venv/bin/python stateParks/rhode_island.py --skip-details
    .venv/bin/python stateParks/rhode_island.py --output /tmp/rhode_island.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Rhode Island",
    "abbr": "RI",
    "list_url": "https://riparks.ri.gov/",
    "park_path_pattern": r"^/details/[^/]+/?$",
}


def main():
    """
    Runs the Rhode Island scrape and writes data/stateParks/rhodeislandParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
