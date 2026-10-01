"""
Scrapes the West Virginia state parks list at https://wvstateparks.com/sitemap.xml and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
wvstateparks.com/parks/ is the park finder, but its park cards render client
side; park pages are /parks/<slug>, so the sitemap is used instead.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes West Virginia's agency.

Usage
-----
    .venv/bin/python stateParks/west_virginia.py
    .venv/bin/python stateParks/west_virginia.py --skip-details
    .venv/bin/python stateParks/west_virginia.py --output /tmp/west_virginia.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "West Virginia",
    "abbr": "WV",
    "list_url": "https://wvstateparks.com/sitemap.xml",
    "list_kind": "sitemap",
    "park_path_pattern": r"^/parks/[^/]+/?$",
}


def main():
    """
    Runs the West Virginia scrape and writes data/stateParks/westvirginiaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
