"""
Scrapes the Indiana state parks list at https://www.in.gov/dnr/state-parks/parks-lakes/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
in.gov/dnr/state-parks/parks-lakes lists every park, lake and state recreation
area at /dnr/state-parks/parks-lakes/<slug>; only the two non-unit pages (the
map/listing page and the Saddle Barns program page) are excluded.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Indiana's agency.

Usage
-----
    .venv/bin/python stateParks/indiana.py
    .venv/bin/python stateParks/indiana.py --skip-details
    .venv/bin/python stateParks/indiana.py --output /tmp/indiana.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Indiana",
    "abbr": "IN",
    "list_url": "https://www.in.gov/dnr/state-parks/parks-lakes/",
    "park_path_pattern": r"^/dnr/state-parks/parks-lakes/[^/]+/?$",
    "exclude_slugs": {"index", "saddle-barns"},
}


def main():
    """
    Runs the Indiana scrape and writes data/stateParks/indianaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
