"""
Scrapes the Tennessee state parks list at https://tnstateparks.com/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
The Find a Park grid renders client side, so the Drupal sitemap is used: every
/parks/<slug> entry is a park page (deeper /parks/<slug>/<topic> pages do not
match), and the two non-park entries are excluded by slug.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Tennessee's agency.

Usage
-----
    .venv/bin/python stateParks/tennessee.py
    .venv/bin/python stateParks/tennessee.py --skip-details
    .venv/bin/python stateParks/tennessee.py --output /tmp/tennessee.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Tennessee",
    "abbr": "TN",
    "list_url": "https://tnstateparks.com/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/parks/[^/]+/?$",
    "exclude_slugs": {"park-trail-maps", "future-tennessee-state-parks"},
}


def main():
    """
    Runs the Tennessee scrape and writes data/stateParks/tennesseeParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
