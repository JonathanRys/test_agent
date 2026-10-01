"""
Scrapes the Missouri state parks list at https://mostateparks.com/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
mostateparks.com serves every park as /park/<slug> and the park finder is a map
widget with no server rendered links, so the Drupal sitemap (an index of two
child sitemaps) is used; utils follows the child sitemaps.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Missouri's agency.

Usage
-----
    .venv/bin/python stateParks/missouri.py
    .venv/bin/python stateParks/missouri.py --skip-details
    .venv/bin/python stateParks/missouri.py --output /tmp/missouri.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Missouri",
    "abbr": "MO",
    "list_url": "https://mostateparks.com/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/park/[^/]+/?$",
}


def main():
    """
    Runs the Missouri scrape and writes data/stateParks/missouriParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
