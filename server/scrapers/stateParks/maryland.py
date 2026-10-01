"""
Scrapes the Maryland state parks list at https://dnr.maryland.gov/publiclands/pages/parkmap.aspx and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
dnr.maryland.gov/publiclands/pages/parkmap.aspx is the state park directory;
Maryland park pages live at /publiclands/Pages/<region>/<park>.aspx (the region
folder is optional), and the hub pages are excluded by slug.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Maryland's agency.

Usage
-----
    .venv/bin/python stateParks/maryland.py
    .venv/bin/python stateParks/maryland.py --skip-details
    .venv/bin/python stateParks/maryland.py --output /tmp/maryland.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Maryland",
    "abbr": "MD",
    "list_url": "https://dnr.maryland.gov/publiclands/pages/parkmap.aspx",
    "park_path_pattern": r"(?i)^/publiclands/pages/(?:[a-z-]+/)?[a-z0-9-]+\.aspx$",
    "exclude_slugs": {"default.aspx", "park-dayuse-reservations.aspx", "parkpass.aspx",
                      "park-events.aspx", "statewide-maryland-park-policies.aspx",
                      "maryland-state-park-service-conservation-corps-programs.aspx",
                      "parkmap.aspx", "park-status-dashboard.aspx"},
}


def main():
    """
    Runs the Maryland scrape and writes data/stateParks/marylandParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
