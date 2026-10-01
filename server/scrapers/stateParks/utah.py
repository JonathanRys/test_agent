"""
Scrapes the Utah state parks list at https://stateparks.utah.gov/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
stateparks.utah.gov/parks is a client rendered map, but the sitemap lists every
/parks/<slug> page, so list_kind=sitemap is used.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Utah's agency.

Usage
-----
    .venv/bin/python stateParks/utah.py
    .venv/bin/python stateParks/utah.py --skip-details
    .venv/bin/python stateParks/utah.py --output /tmp/utah.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Utah",
    "abbr": "UT",
    "list_url": "https://stateparks.utah.gov/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the Utah scrape and writes data/stateParks/utahParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
