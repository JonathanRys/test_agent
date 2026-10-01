"""
Scrapes the Louisiana state parks list at https://www.lastateparks.com/parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
lastateparks.com serves every park as /parks/<slug>. The site answers 403 to
scrapers (bot protection), so the scraper still runs and reports the block
instead of failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Louisiana's agency.

Usage
-----
    .venv/bin/python stateParks/louisiana.py
    .venv/bin/python stateParks/louisiana.py --skip-details
    .venv/bin/python stateParks/louisiana.py --output /tmp/louisiana.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Louisiana",
    "abbr": "LA",
    "list_url": "https://www.lastateparks.com/parks",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the Louisiana scrape and writes data/stateParks/louisianaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
