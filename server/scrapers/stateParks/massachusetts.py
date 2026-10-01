"""
Scrapes the Massachusetts state parks list at https://www.mass.gov/visit-massachusetts-state-parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
mass.gov lists state parks and forests under /location/<park>; the site answers
403 to scrapers (bot protection), so the scraper still runs and reports the
block instead of failing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Massachusetts' agency.

Usage
-----
    .venv/bin/python stateParks/massachusetts.py
    .venv/bin/python stateParks/massachusetts.py --skip-details
    .venv/bin/python stateParks/massachusetts.py --output /tmp/massachusetts.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Massachusetts",
    "abbr": "MA",
    "list_url": "https://www.mass.gov/visit-massachusetts-state-parks",
    "park_path_pattern": r"^/location/[^/]+/?$",
}


def main():
    """
    Runs the Massachusetts scrape and writes data/stateParks/massachusettsParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
