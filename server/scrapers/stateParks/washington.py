"""
Scrapes the Washington state parks list at https://parks.wa.gov/find-parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
parks.wa.gov/find-parks lists every state park as /find-parks/state-parks/<slug>;
the sno-parks sit under a different prefix and are not matched. Park boundaries
come from the state parks ArcGIS park boundary service.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Washington's agency.

Usage
-----
    .venv/bin/python stateParks/washington.py
    .venv/bin/python stateParks/washington.py --skip-details
    .venv/bin/python stateParks/washington.py --output /tmp/washington.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Washington",
    "abbr": "WA",
    "list_url": "https://parks.wa.gov/find-parks",
    "park_path_pattern": r"^/find-parks/state-parks/[^/]+/?$",
    "boundary_service": "https://services5.arcgis.com/4LKAHwqnBooVDUlX/arcgis/rest/services/ParkBoundaries/FeatureServer",
}


def main():
    """
    Runs the Washington scrape and writes data/stateParks/washingtonParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
