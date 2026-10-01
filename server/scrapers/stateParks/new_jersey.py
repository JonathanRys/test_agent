"""
Scrapes the New Jersey state parks list at https://dep.nj.gov/parksandforests/state-park/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
The NJDEP parks hub is a client rendered shell, so the config targets the park
page shapes the site uses (/venue/<slug>/ and
/parksandforests/state-park/<slug>/) and returns no parks until the hub renders a
server side list.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes New Jersey's agency.

Usage
-----
    .venv/bin/python stateParks/new_jersey.py
    .venv/bin/python stateParks/new_jersey.py --skip-details
    .venv/bin/python stateParks/new_jersey.py --output /tmp/new_jersey.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "New Jersey",
    "abbr": "NJ",
    "list_url": "https://dep.nj.gov/parksandforests/state-park/",
    "park_path_pattern": r"^/(?:venue|parksandforests/state-park)/[^/]+/?$",
}


def main():
    """
    Runs the New Jersey scrape and writes data/stateParks/newjerseyParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
