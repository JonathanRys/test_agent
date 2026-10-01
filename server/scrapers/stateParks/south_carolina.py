"""
Scrapes the South Carolina state parks list at https://southcarolinaparks.com/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
South Carolina's park finder is a client rendered map, so this config takes the
root level park slugs (/hunting-island) the site pages are served from and
drops the site navigation slugs; parks the home page does not link are missed
until the finder server renders.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes South Carolina's agency.

Usage
-----
    .venv/bin/python stateParks/south_carolina.py
    .venv/bin/python stateParks/south_carolina.py --skip-details
    .venv/bin/python stateParks/south_carolina.py --output /tmp/south_carolina.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "South Carolina",
    "abbr": "SC",
    "list_url": "https://southcarolinaparks.com/",
    "park_path_pattern": r"^/[a-z0-9][a-z0-9-]*/?$",
    "exclude_slugs": {"park-finder", "camping-and-lodging", "see-and-do",
                      "education-and-history", "mission-and-stories",
                      "programs-and-events", "plan-your-visit", "parkpass",
                      "about-us", "contact-us", "search", "news", "blog",
                      "social-media", "work-with-us", "careers", "donate"},
}


def main():
    """
    Runs the South Carolina scrape and writes data/stateParks/southcarolinaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
