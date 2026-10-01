"""
Scrapes the Virginia state parks list at https://www.dcr.virginia.gov/state-parks/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
dcr.virginia.gov/state-parks/ lists every park as /state-parks/<slug> next to the
section links that share that prefix, which are excluded by slug.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Virginia's agency.

Usage
-----
    .venv/bin/python stateParks/virginia.py
    .venv/bin/python stateParks/virginia.py --skip-details
    .venv/bin/python stateParks/virginia.py --output /tmp/virginia.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Virginia",
    "abbr": "VA",
    "list_url": "https://www.dcr.virginia.gov/state-parks/",
    "park_path_pattern": r"^/state-parks/[^/]+/?$",
    "exclude_slugs": {"what-to-do", "events", "amenity-search", "trail-quest",
                      "paddle-quest", "blog", "plan-your-visit", "reservations",
                      "park-conditions", "find-a-park", "state-parks"},
}


def main():
    """
    Runs the Virginia scrape and writes data/stateParks/virginiaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
