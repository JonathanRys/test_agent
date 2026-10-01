"""
Scrapes the Georgia state parks list at https://gastateparks.org/Map and descends into each park
page for reservation, fee, permit, activity and boundary signals.

Structure
---------
gastateparks.org/Map renders one article listing every park and historic site
as a root level slug (/AmicalolaFalls) with the unit name as the anchor text.
The older /parks-ga source is paginated and mixes navigation slugs into the
same shape, so parse_parks reads the Map article first and then walks the
parks-ga pages only to pick up the units the map leaves out (the lodge and
special sites such as Amicalola Falls and Unicoi); exclude_slugs drops the
navigation slugs that share the root-slug pattern.

The camping index (gastateparks.org/Camping) lists the parks that take campers
as those same park pages, so campgrounds_shared_with_parks keeps every unit in
the parks file and adds the camping subset to the campground file.

Everything else (HTTP + per-state page cache, reservation/permit/activity
detection, entry-fee age tiers, activities table ids, untracked activities,
boundary geodata, CLI) is shared with every other state through scrapers/utils.py;
this file only describes Georgia's agency.

Usage
-----
    .venv/bin/python stateParks/georgia.py
    .venv/bin/python stateParks/georgia.py --skip-details
    .venv/bin/python stateParks/georgia.py --output /tmp/georgia.json
"""
import os
import sys

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

# utils.py lives one directory up (scrapers/ is not a package), so make it importable.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import utils  # noqa: E402  (must follow the sys.path bootstrap above)

PARKS_GA_URL = "https://gastateparks.org/parks-ga"


def parse_parks(soup, config, state_id):
    """
    Takes every park in the Map article, then fills the gaps from the parks-ga
    listing pages. Map names win; exclude_slugs keeps the site navigation
    (/Map, /Reservations, /Golfing, ...) out of the records.
    """
    pattern = config["park_path_pattern"]
    exclude = {slug.lower() for slug in config.get("exclude_slugs", ())}

    def wanted(href):
        return bool(re.match(pattern, href)) and href[1:].lower() not in exclude

    parks = []
    recorded = set()

    article = soup.select_one("article.basic-page-parks")
    for anchor in article.select("a[href]") if article else []:
        href = anchor["href"].strip()
        if not wanted(href) or href in recorded:
            continue
        name = utils.clean_park_name(anchor.get_text(" ", strip=True))
        if not name:
            continue
        recorded.add(href)
        parks.append({"stateId": state_id, "name": name,
                      "link": urljoin(config["list_url"], href)})

    # The map omits a handful of lodge/special units; the listing pages carry
    # them. Follow the listing's own pager until a page adds nothing new.
    cache = config.get("_cache") or {}
    known = set(recorded)
    for page in range(8):
        url = PARKS_GA_URL + (f"?page={page}" if page else "")
        entry = utils.fetch_list_html(url, cache)
        if entry.get("status") != 200 or not entry.get("html"):
            break
        page_soup = BeautifulSoup(entry["html"], "html.parser")

        # Names per row: the title anchor, never the "Read more about ..." copy.
        names = {}
        hrefs = []
        for row in page_soup.select(".views-row"):
            for anchor in row.select("a[href]"):
                href = anchor["href"].strip()
                if not re.match(pattern, href):
                    continue
                if href not in hrefs:
                    hrefs.append(href)
                text = utils.clean_park_name(anchor.get_text(" ", strip=True))
                if not text or text.casefold() in utils.GENERIC_LINK_TEXT:
                    continue
                if text.casefold().startswith("read more"):
                    continue
                names.setdefault(href, text)

        fresh = [href for href in hrefs if href not in known]
        if not fresh:
            break
        known.update(hrefs)

        for href in fresh:
            if href in recorded or href[1:].lower() in exclude:
                continue
            name = names.get(href)
            if not name:
                continue
            recorded.add(href)
            parks.append({"stateId": state_id, "name": name,
                          "link": urljoin(PARKS_GA_URL, href)})
    return parks


CONFIG = {
    "state": "Georgia",
    "abbr": "GA",
    "list_url": "https://gastateparks.org/Map",
    "park_path_pattern": r"^/[A-Za-z0-9]+$",
    "parse_list": parse_parks,
    # Root slugs that match the park shape but are site navigation or sections.
    "exclude_slugs": {"map", "reservations", "parkcareers", "parkclubs", "parktag",
                      "parkactivities", "parkresources", "parkrules", "eventlist",
                      "thingstoknow", "stateorganizations", "accessibility",
                      "archaeology", "fieldtrips", "gatherings", "giftcards",
                      "golfing", "monumentalmoments", "history",
                      "uniqueaccommodations"},
    # The camping page repeats the park pages for the units that take campers.
    "campground_list_url": "https://gastateparks.org/Camping",
    "campground_path_pattern": r"^/[A-Za-z0-9]+$",
    "container": "article.basic-page-activity",
    "campgrounds_shared_with_parks": True,
}


def main():
    """
    Runs the Georgia scrape and writes data/stateParks/georgiaParks.json.
    """
    utils.run(CONFIG)


if __name__ == "__main__":
    main()