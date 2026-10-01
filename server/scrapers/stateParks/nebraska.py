"""
Scrapes the Nebraska state parks list at https://outdoornebraska.gov/stateparks/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
outdoornebraska.gov/stateparks/ lists every park as /stateparks/<slug>. The site
answers 403 to scrapers (Cloudflare), so the scraper still runs and reports the
block instead of failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Nebraska's agency.

Usage
-----
    .venv/bin/python stateParks/nebraska.py
    .venv/bin/python stateParks/nebraska.py --skip-details
    .venv/bin/python stateParks/nebraska.py --output /tmp/nebraska.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Nebraska",
    "abbr": "NE",
    "list_url": "https://outdoornebraska.gov/stateparks/",
    "park_path_pattern": r"^/stateparks/[^/]+/?$",
}


def main():
    """
    Runs the Nebraska scrape and writes data/stateParks/nebraskaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
