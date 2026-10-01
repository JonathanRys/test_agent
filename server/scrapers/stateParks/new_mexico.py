"""
Scrapes the New Mexico state parks list at https://www.emnrd.nm.gov/spd/find-a-park/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
emnrd.nm.gov/spd/find-a-park lists every park as /spd/find-a-park/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes New Mexico's agency.

Usage
-----
    .venv/bin/python stateParks/new_mexico.py
    .venv/bin/python stateParks/new_mexico.py --skip-details
    .venv/bin/python stateParks/new_mexico.py --output /tmp/new_mexico.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "New Mexico",
    "abbr": "NM",
    "list_url": "https://www.emnrd.nm.gov/spd/find-a-park/",
    "park_path_pattern": r"^/spd/find-a-park/[^/]+/?$",
}


def main():
    """
    Runs the New Mexico scrape and writes data/stateParks/newmexicoParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
