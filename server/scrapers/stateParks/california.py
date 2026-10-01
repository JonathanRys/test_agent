"""
Scrapes the California state parks list at https://www.parks.ca.gov/Find-a-Park and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
parks.ca.gov is a Sitefinity app: park pages are query URLs (?page_id=N). The
Find a Park page renders one listing card per unit server side (.park-display),
each card carrying the park link and the unit name the agency publishes
("Admiral William Standley SRA"), so parse_parks reads only those cards. The
header and footer link to their own ?page_id= pages (About Us, FAQs, Customer
Service, ...); those are outside the listing and never enter the records -
collecting every ?page_id= link instead pulled them in as parks, and filtering
by page title did not help because every title ends in the site brand
"| California State Parks".

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes California's agency.

Usage
-----
    .venv/bin/python stateParks/california.py
    .venv/bin/python stateParks/california.py --skip-details
    .venv/bin/python stateParks/california.py --output /tmp/california.json
"""
import os
import sys

import re
from urllib.parse import urljoin

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)


def card_name(title):
    """
    Returns a card's unit name: the title's text without the screen reader
    suffix (", State Recreation Area, Open") that sits in .sr-only spans.
    """
    parts = [
        str(string)
        for string in title.find_all(string=True)
        if string.find_parent(class_="sr-only") is None
    ]
    return utils.clean_park_name(" ".join(parts))


def parse_parks(soup, config, state_id):
    """
    Turns each Find a Park listing card (.park-display) into a record: the card's
    anchor is the park page, the card's title is the unit name. Links outside the
    listing (header/footer ?page_id= pages) are never visited.
    """
    pattern = config["park_path_pattern"]
    parks = []
    seen = set()
    for card in soup.select(".park-display"):
        anchor = card.select_one("a[href]")
        if anchor is None:
            continue
        href = anchor["href"].strip()
        if not re.match(pattern, href):
            continue
        link = urljoin(config["list_url"], href)
        if link in seen:
            continue
        name = card_name(card.select_one(".thumb-info-inner") or anchor)
        if not name:
            continue
        seen.add(link)
        parks.append({"stateId": state_id, "name": name, "link": link})
    return parks


CONFIG = {
    "state": "California",
    "abbr": "CA",
    "list_url": "https://www.parks.ca.gov/Find-a-Park",
    "park_path_pattern": r"^/\?page_id=\d+$",
    "parse_list": parse_parks,
}


def main():
    """
    Runs the California scrape and writes data/stateParks/californiaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
