"""
Scrapes the Ohio state parks list at https://ohiodnr.gov/go-and-do/plan-a-visit/find-a-property and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
Ohio DNR park pages live at
/go-and-do/plan-a-visit/find-a-property/<slug>; the 'Find a Destination' map page
renders client side, so park pages are picked up from any server rendered link
and, failing that, this config stays empty rather than guessing.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Ohio's agency.

Usage
-----
    .venv/bin/python stateParks/ohio.py
    .venv/bin/python stateParks/ohio.py --skip-details
    .venv/bin/python stateParks/ohio.py --output /tmp/ohio.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Ohio",
    "abbr": "OH",
    "list_url": "https://ohiodnr.gov/go-and-do/plan-a-visit/find-a-property",
    "park_path_pattern": r"^/go-and-do/plan-a-visit/find-a-property/[^/]+/?$",
    "boundary_service": "https://gis.ohiodnr.gov/arcgis/rest/services/OIT_Services/ODNR_ODNR_Lands_Public_nolakes/FeatureServer",
}


def main():
    """
    Runs the Ohio scrape and writes data/stateParks/ohioParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
