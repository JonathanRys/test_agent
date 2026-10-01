"""
Scrapes the Pennsylvania state parks list at https://www.pa.gov/agencies/dcnr/recreation/where-to-go/state-parks/find-a-park and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
pa.gov's find-a-park page renders its cards client side, so the config targets
the park page shape
(/agencies/dcnr/recreation/where-to-go/state-parks/find-a-park/<slug>) and
returns no parks until the page server renders its list.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Pennsylvania's agency.

Usage
-----
    .venv/bin/python stateParks/pennsylvania.py
    .venv/bin/python stateParks/pennsylvania.py --skip-details
    .venv/bin/python stateParks/pennsylvania.py --output /tmp/pennsylvania.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Pennsylvania",
    "abbr": "PA",
    "list_url": "https://www.pa.gov/agencies/dcnr/recreation/where-to-go/state-parks/find-a-park",
    "park_path_pattern": r"^/agencies/dcnr/recreation/where-to-go/state-parks/find-a-park/[^/]+/?$",
}


def main():
    """
    Runs the Pennsylvania scrape and writes data/stateParks/pennsylvaniaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
