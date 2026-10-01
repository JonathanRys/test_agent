"""
Scrapes the Connecticut state parks list at https://portal.ct.gov/deep/state-parks/listing-of-state-parks and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
portal.ct.gov's 'Listing of State Parks' page links every park at
/deep/state-parks/parks/<slug>; the state forests sit under a different prefix and
are therefore not matched. Those park pages now redirect to ctparks.com, which
also publishes the camping index: ctparks.com/camping tabs one card per park
that camps (Show Me Everything / Backcountry / Cabin / Tent / ...), and the
card's data-content-map-title attribute is the unit name while the anchor text
mixes in the town. The camping records link the ctparks.com pages, so the parks
file keeps its portal.ct.gov records and the campground file gets the camping
subset.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Connecticut's agency.

Usage
-----
    .venv/bin/python stateParks/connecticut.py
    .venv/bin/python stateParks/connecticut.py --skip-details
    .venv/bin/python stateParks/connecticut.py --output /tmp/connecticut.json
"""
import os
import sys

import re
from urllib.parse import urljoin, urlparse

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)


def parse_camping_list(soup, config, state_id):
    """
    Reads the camping page's park cards. Every park repeats once per interest
    tab, records are deduped by link, and the name comes from the card's
    data-content-map-title because the anchor text appends town and status.
    """
    pattern = config["park_path_pattern"]
    records = []
    seen = set()
    for card in soup.select(".ctdsp-interest-parks-item article[data-content-map-title]"):
        anchor = card.select_one("a[href]")
        if anchor is None:
            continue
        href = anchor["href"].strip()
        path = urlparse(urljoin(config["list_url"], href)).path
        if not re.match(pattern, path):
            continue
        link = urljoin(config["list_url"], href)
        if link in seen:
            continue
        name = utils.clean_park_name(card["data-content-map-title"])
        if not name:
            continue
        seen.add(link)
        records.append({"stateId": state_id, "name": name, "link": link})
    return records


CONFIG = {
    "state": "Connecticut",
    "abbr": "CT",
    "list_url": "https://portal.ct.gov/deep/state-parks/listing-of-state-parks",
    "park_path_pattern": r"^/deep/state-parks/parks/[^/]+/?$",
    # The camping index lives on ctparks.com (where the park pages redirect to)
    # and repeats the park pages for the units that take campers.
    "campground_list_url": "https://ctparks.com/camping",
    "campground_path_pattern": r"^/parks/[^/]+/?$",
    "campground_parse_list": parse_camping_list,
    "campgrounds_shared_with_parks": True,
}


def main():
    """
    Runs the Connecticut scrape and writes data/stateParks/connecticutParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
