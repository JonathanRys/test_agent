"""
Scrapes the Alabama state parks list at https://www.alapark.com/parks and descends
into each park page for reservation, fee, permit, activity and boundary signals.

Pipeline (shared with every other state scraper via scrapers/utils.py)
---------------------------------------------------------------------
1. List     - the parks index renders each park as a card inside <main>:

                  <div class="field-content parks-list-title">
                      <a href="/parks/cheaha-state-park">Cheaha State Park</a>
                  </div>

   The same links also appear in the header mega menu, so parsing is scoped to
   <main> to avoid duplicates.
2. Details  - every park page is fetched (cached under server/scrapers/.cache/
   alabama.json) and its navigation is stripped before keyword detection so site
   wide menus do not leak into each park's activities.

utils additionally shapes entry fees into age-range tiers, resolves activities to
their activities table ids, reports site activities the table does not track yet
(data/untrackedActivities.json) and resolves boundary geodata when a park page
links .geojson/.kml/ArcGIS layers.

Output record
-------------
[
  {
    "stateId": 1,                    # 1-based id from data/states.json
    "name": "Blue Springs State Park",
    "link": "https://www.alapark.com/parks/blue-springs-state-park",
    "reservationAvailable": true,    # reservation language or booking link found
    "entryFee": [                    # age-range tiers parsed from the park page; a fee
      {"ageRange": "4-11", "fee": "$3.00"},   # without an age breakdown keeps ageRange
      {"ageRange": "12-61", "fee": "$5.00"},  # null, and an unknown fee stays null
      {"ageRange": "62+", "fee": "$3.00"},
      {"ageRange": "3 and under", "fee": "Free"}
    ],
    "permitRequired": false,         # true only when a permit requirement is stated
    "activities": [7, 12],           # activities table ids (data/activities.json order)
    "boundary": null                 # "geo/al/<slug>.geojson" (data/stateParks/geo/)
                                    # or a KML URL when found
  }
]

Usage
-----
    .venv/bin/python stateParks/alabama.py                # list + park page details
    .venv/bin/python stateParks/alabama.py --skip-details # list only (fast, no park page fetches)
    .venv/bin/python stateParks/alabama.py --output /tmp/al.json
"""
import os
import sys

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

CONFIG = {
    "state": "Alabama",
    "abbr": "AL",
    "list_url": "https://www.alapark.com/parks",
    # Park pages live at /parks/<slug> relative to the site root.
    "park_path_pattern": r"^/parks/[^/]+/?$",
    "container": "main",
    # Precise card selector; falls back to the path pattern inside <main> when absent.
    "link_selector": "div.parks-list-title a[href]",
}


def main():
    """
    Runs the Alabama scrape and writes data/stateParks/alabamaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
