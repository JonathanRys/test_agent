import os
import re
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://www.nps.gov"
INDEX_URL = f"{BASE_URL}/index.htm"
STATES_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/states.json"))
OUTPUT_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/npsParks.json"))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def load_states():
    """
    Loads states.json to map state uppercase abbreviations to their 1-based database ID.
    The states table uses auto-increment ID starting at 1 matching the order in states.json.
    """
    with open(STATES_FILE, "r", encoding="utf-8") as f:
        states_data = json.load(f)

    # Map state uppercase abbreviation -> 1-based index (stateId)
    state_id_map = {}
    for index, state in enumerate(states_data, start=1):
        abbr = state["abbreviation"].upper()
        state_id_map[abbr] = index

    return state_id_map


def get_state_page_links():
    """
    Scrapes the NPS homepage (https://www.nps.gov/index.htm) to extract all state page URLs.
    Returns a sorted list of full URLs.
    """
    response = requests.get(INDEX_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    state_urls = []
    seen = set()

    # State links typically follow /state/{abbr}/index.htm
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        match = re.search(r"/state/([a-zA-Z]{2})/index\.htm", href, re.IGNORECASE)
        if match:
            state_abbr = match.group(1).lower()
            canonical_path = f"/state/{state_abbr}/index.htm"
            if canonical_path not in seen:
                seen.add(canonical_path)
                state_urls.append(urljoin(BASE_URL, canonical_path))

    return sorted(state_urls)


def scrape_parks_for_state(state_url, state_id_map):
    """
    Scrapes parks listed on a state page (e.g. https://www.nps.gov/state/ri/index.htm).
    Returns a list of dicts:
    [{
        "stateId": number,
        "name": string,
        "link": string
    }]
    """
    # Extract state abbreviation from url
    match = re.search(r"/state/([a-zA-Z]{2})/index\.htm", state_url, re.IGNORECASE)
    if not match:
        return []

    abbr = match.group(1).upper()
    state_id = state_id_map.get(abbr)
    if state_id is None:
        print(f"Warning: State abbreviation '{abbr}' not found in states.json")
        return []

    response = requests.get(state_url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    park_list = soup.find("ul", id="list_parks")
    if not park_list:
        print(f"Warning: No #list_parks element found on {state_url}")
        return []

    # Each park entry has an id starting with 'asset_'
    park_items = park_list.find_all("li", id=lambda x: x and x.startswith("asset_"))

    state_parks = []
    for item in park_items:
        # Park name is inside an h3 tag
        h3 = item.find("h3")
        if not h3:
            continue
        name = h3.get_text(strip=True)

        # Conditions link
        conditions_a = item.find("a", href=lambda x: x and "conditions.htm" in x)
        if conditions_a:
            raw_link = conditions_a["href"].strip()
            # Normalize to https
            link = urljoin(BASE_URL, raw_link)
            if link.startswith("http://"):
                link = "https://" + link[len("http://"):]
        else:
            # Fallback: construct conditions URL from park root link
            park_a = h3.find("a", href=True)
            if park_a:
                park_path = park_a["href"].strip()
                park_unit = park_path.strip("/")
                link = f"{BASE_URL}/{park_unit}/planyourvisit/conditions.htm"
            else:
                continue

        state_parks.append({
            "stateId": state_id,
            "name": name,
            "link": link
        })

    return state_parks


def scrape_all_parks():
    """
    Main scraping function. Scrapes all state pages found on the index page,
    collects park records, and writes them to npsParks.json.
    """
    state_id_map = load_states()
    state_urls = get_state_page_links()
    print(f"Discovered {len(state_urls)} state pages from {INDEX_URL}")

    all_parks = []
    for idx, state_url in enumerate(state_urls, start=1):
        abbr_match = re.search(r"/state/([a-zA-Z]{2})/index\.htm", state_url)
        abbr = abbr_match.group(1).upper() if abbr_match else "UNKNOWN"
        print(f"[{idx}/{len(state_urls)}] Scraping {abbr} from {state_url}...")
        parks = scrape_parks_for_state(state_url, state_id_map)
        print(f"  Found {len(parks)} parks")
        all_parks.extend(parks)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_parks, f, indent=2, ensure_ascii=False)

    print(f"\nScraping complete! Successfully wrote {len(all_parks)} parks to {OUTPUT_FILE}")


if __name__ == "__main__":
    scrape_all_parks()
