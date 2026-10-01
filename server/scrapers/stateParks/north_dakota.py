"""
Scrapes the North Dakota state parks list at https://www.parkrec.nd.gov/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
parkrec.nd.gov serves every park at the site root as /<name>-state-park; the
sitemap is used because the site menu is a JavaScript widget with no server
rendered list, and the pattern only accepts root slugs ending in -state-park.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes North Dakota's agency.

Usage
-----
    .venv/bin/python stateParks/north_dakota.py
    .venv/bin/python stateParks/north_dakota.py --skip-details
    .venv/bin/python stateParks/north_dakota.py --output /tmp/north_dakota.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "North Dakota",
    "abbr": "ND",
    "list_url": "https://www.parkrec.nd.gov/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/[^/]+-state-park/?$",
}


def main():
    """
    Runs the North Dakota scrape and writes data/stateParks/northdakotaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
