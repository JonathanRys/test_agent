"""
Scrapes the Maine state parks list at https://www.maine.gov/dacf/parks/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
maine.gov/dacf/parks is the parks hub, but the park list lives in the online
park search (a CGI form) and the park sites themselves are only linked from
there, so the config targets the park site shape
(/dacf/parks/<park>/index.shtml) and returns no parks until the hub renders a
server side list.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Maine's agency.

Usage
-----
    .venv/bin/python stateParks/maine.py
    .venv/bin/python stateParks/maine.py --skip-details
    .venv/bin/python stateParks/maine.py --output /tmp/maine.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Maine",
    "abbr": "ME",
    "list_url": "https://www.maine.gov/dacf/parks/",
    "park_path_pattern": r"^/dacf/parks/[a-z0-9-]+/index\.shtml$",
}


def main():
    """
    Runs the Maine scrape and writes data/stateParks/maineParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
