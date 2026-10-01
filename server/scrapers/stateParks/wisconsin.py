"""
Scrapes the Wisconsin state parks list at https://dnr.wisconsin.gov/topic/parks/findapark and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
dnr.wisconsin.gov/topic/parks/findapark links every park as /topic/parks/<slug>
with empty anchor text, so names come from the slug; the section pages that
share the prefix are excluded by slug.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Wisconsin's agency.

Usage
-----
    .venv/bin/python stateParks/wisconsin.py
    .venv/bin/python stateParks/wisconsin.py --skip-details
    .venv/bin/python stateParks/wisconsin.py --output /tmp/wisconsin.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Wisconsin",
    "abbr": "WI",
    "list_url": "https://dnr.wisconsin.gov/topic/parks/findapark",
    "park_path_pattern": r"^/topic/parks/[^/]+/?$",
    "name_from": "slug",
    "exclude_slugs": {"findapark", "strategicplan", "admission", "camping",
                      "merchandise", "newtoparks", "iceagetrail", "northcountrytrail"},
}


def main():
    """
    Runs the Wisconsin scrape and writes data/stateParks/wisconsinParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
