"""
Scrapes the Delaware state parks list at https://www.destateparks.com/park-finder/ and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
The park finder page (destateparks.com/park-finder/) links every unit as
/park/<slug>/; the anchor text is the park name.

The camping index is destateparks.com/tent-camping/: its #campsites section has
one card per campground (tent/yurt and RV camping share the same five parks),
with the unit heading in .campsites-info and the park link in the Learn More
button; the header's park menu also links /park/ pages, so only #campsites is
read. The reservation-information page the agency pairs with it is booking
policy: it names the same five campgrounds but links only Reserve America, so
it contributes no records. The index repeats the park pages, so those five
stay in the parks file and are added to the campground file as well.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Delaware's agency.

Usage
-----
    .venv/bin/python stateParks/delaware.py
    .venv/bin/python stateParks/delaware.py --skip-details
    .venv/bin/python stateParks/delaware.py --output /tmp/delaware.json
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
    Reads the in-content campsite sections: one park per .campsites-park-wrap,
    named by its heading and linked through the button that matches the park
    path pattern (the Reserve Now buttons point at reserveamerica.com).
    """
    pattern = config["park_path_pattern"]
    records = []
    seen = set()
    section = soup.select_one("#campsites")
    if section is None:
        return records
    for wrap in section.select(".campsites-park-wrap"):
        heading = wrap.select_one(".campsites-info h3")
        name = utils.clean_park_name(heading.get_text(" ", strip=True)) if heading else ""
        link = None
        for anchor in wrap.select("a[href]"):
            href = anchor["href"].strip()
            target = urljoin(config["list_url"], href)
            if re.match(pattern, urlparse(target).path):
                link = target.rstrip("/")
                break
        if not name or not link or link in seen:
            continue
        seen.add(link)
        records.append({"stateId": state_id, "name": name, "link": link})
    return records


CONFIG = {
    "state": "Delaware",
    "abbr": "DE",
    "list_url": "https://www.destateparks.com/park-finder/",
    "park_path_pattern": r"^/park/[^/]+/?$",
    "campground_list_url": "https://www.destateparks.com/tent-camping/",
    "campground_path_pattern": r"^/park/[^/]+/?$",
    "campground_parse_list": parse_camping_list,
    "campgrounds_shared_with_parks": True,
}


def main():
    """
    Runs the Delaware scrape and writes data/stateParks/delawareParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
