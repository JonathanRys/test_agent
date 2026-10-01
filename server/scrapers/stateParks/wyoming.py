"""
Scrapes the Wyoming state parks list at https://wyoparks.wyo.gov/index.php/places-to-go and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
wyoparks.wyo.gov/index.php/places-to-go lists every park as
/index.php/places-to-go/<slug>.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Wyoming's agency.

Usage
-----
    .venv/bin/python stateParks/wyoming.py
    .venv/bin/python stateParks/wyoming.py --skip-details
    .venv/bin/python stateParks/wyoming.py --output /tmp/wyoming.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Wyoming",
    "abbr": "WY",
    "list_url": "https://wyoparks.wyo.gov/index.php/places-to-go",
    "park_path_pattern": r"^/index\.php/places-to-go/[^/]+/?$",
}


def main():
    """
    Runs the Wyoming scrape and writes data/stateParks/wyomingParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
