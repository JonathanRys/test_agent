"""
Scrapes the Mississippi state parks list at https://www.mdwfp.com/parks-destinations/park-finder and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
mdwfp.com/parks-destinations/park-finder links every park as
/parks-destinations/park/<slug>; the anchor text is empty on that page, so names
come from the URL slug.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Mississippi's agency.

Usage
-----
    .venv/bin/python stateParks/mississippi.py
    .venv/bin/python stateParks/mississippi.py --skip-details
    .venv/bin/python stateParks/mississippi.py --output /tmp/mississippi.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Mississippi",
    "abbr": "MS",
    "list_url": "https://www.mdwfp.com/parks-destinations/park-finder",
    "park_path_pattern": r"^/parks-destinations/park/[^/]+/?$",
    "name_from": "slug",
}


def main():
    """
    Runs the Mississippi scrape and writes data/stateParks/mississippiParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
