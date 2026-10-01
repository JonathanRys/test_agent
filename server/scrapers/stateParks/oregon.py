"""
Scrapes the Oregon state parks list at https://oregonstateparks.org/find-a-park and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
oregonstateparks.org serves every park as /park/<slug>. Park boundaries come
from the state's own ArcGIS land ownership service.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Oregon's agency.

Usage
-----
    .venv/bin/python stateParks/oregon.py
    .venv/bin/python stateParks/oregon.py --skip-details
    .venv/bin/python stateParks/oregon.py --output /tmp/oregon.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Oregon",
    "abbr": "OR",
    "list_url": "https://oregonstateparks.org/find-a-park",
    "park_path_pattern": r"^/park/[^/]+/?$",
    "boundary_service": "https://maps.prd.state.or.us/arcgis/rest/services/Land_ownership/Oregon_State_Parks/FeatureServer/0",
}


def main():
    """
    Runs the Oregon scrape and writes data/stateParks/oregonParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
