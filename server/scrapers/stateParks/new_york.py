"""
Scrapes the New York state parks list at https://parks.ny.gov/parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
parks.ny.gov/parks lists every park as /parks/<slug>. The site answers 403 to
scrapers (Cloudflare), so the scraper still runs and reports the block instead
of failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes New York's agency.

Usage
-----
    .venv/bin/python stateParks/new_york.py
    .venv/bin/python stateParks/new_york.py --skip-details
    .venv/bin/python stateParks/new_york.py --output /tmp/new_york.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "New York",
    "abbr": "NY",
    "list_url": "https://parks.ny.gov/parks",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the New York scrape and writes data/stateParks/newyorkParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
