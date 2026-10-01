"""
Scrapes the Arkansas state parks list at https://www.arkansas.com/state-parks/explore/parks and descends
into each park page for reservation, fee, permit, activity and boundary signals.

Structure
---------
arkansas.com/state-parks/explore/parks lists every park as
/state-parks/explore/parks/<slug> - 54 units over the four "?page=0..3" view
pages that list_page_limit follows - and
/state-parks/stay-in-a-park/camping is the agency's campground index: it repeats
those park pages for the 33 units that take campers and, on each card, links the
unit's reserve.arkansasstateparks.com booking page. parse_camping_list reads the
card heading for the name and that booking link as the campground's link, so
arkansas_campgrounds.json holds sites rather than a second copy of the park list.
Because the index repeats park pages instead of listing separate campgrounds, the
parks file keeps every unit (campgrounds_shared_with_parks).

Each card carries two anchors for the same park (an image link with no text, then
<h2><a class="d-block">Park Name</a></h2>), so link_selector pins the name to the
heading. arkansas.com answers 403 to scrapers (Varnish bot protection), so the
scraper still runs and reports the block instead of failing; park pages that could
not be read keep the unknown defaults and are re-fetched by the next run.

Everything else (HTTP + per-state page cache, pager following, reservation/permit/
activity detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Arkansas' agency.

Usage
-----
    .venv/bin/python stateParks/arkansas.py
    .venv/bin/python stateParks/arkansas.py --skip-details
    .venv/bin/python stateParks/arkansas.py --output /tmp/arkansas.json
"""
import os
import sys
from urllib.parse import urljoin

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

# Every camping card offers the unit's booking page under this host.
RESERVE_LINK_PREFIX = "https://reserve.arkansasstateparks.com/"
CARD_SELECTOR = "div.views-row"


def parse_camping_list(soup, config, state_id):
    """
    Reads the campground index (/state-parks/stay-in-a-park/camping).

    Each card names the unit in its heading and links that unit's
    reserve.arkansasstateparks.com booking page beside it. The booking link is
    what the campground record keeps, and a unit whose card publishes none
    (Mississippi River camps first come, first served) falls back to its park
    page so it is not dropped from the campgrounds file.
    """
    records = []
    seen = set()
    for card in soup.select(CARD_SELECTOR):
        heading = card.select_one("h2 a.d-block")
        if heading is None:
            continue
        name = utils.clean_park_name(heading.get_text(" ", strip=True))
        reserve = card.select_one(f'a[href^="{RESERVE_LINK_PREFIX}"]')
        link = (reserve["href"] if reserve else urljoin(config["list_url"], heading["href"])).strip()
        link = link.rstrip("/")
        if not name or not link or link in seen:
            continue
        seen.add(link)
        records.append({"stateId": state_id, "name": name, "link": link})
    return records


CONFIG = {
    "state": "Arkansas",
    "abbr": "AR",
    "list_url": "https://www.arkansas.com/state-parks/explore/parks",
    "park_path_pattern": r"^/state-parks/explore/parks/[^/]+/?$",
    # The cards link their image (empty text) before the heading, so the heading
    # anchor is what supplies the park name.
    "link_selector": "h2 a.d-block",
    # Four "?page=0..3" view pages; the pager's own links are followed, so the cap
    # only has to cover them.
    "list_page_limit": 5,
    "campground_list_url": "https://www.arkansas.com/state-parks/stay-in-a-park/camping",
    "campground_parse_list": parse_camping_list,
    # The camping index points at park pages rather than separate campground
    # pages, so a camping unit stays in the parks file as well.
    "campgrounds_shared_with_parks": True,
    # Park pages link camping sections (/stay-in-a-park/cabins, /camping) instead
    # of individual campgrounds, and the camping index above covers every unit
    # that takes campers.
    "campground_links": False,
}


def main():
    """
    Runs the Arkansas scrape and writes data/stateParks/arkansasParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()
