"""Build frontend/public/cities.json from GeoNames (CC BY 4.0).

Downloads cities15000.zip and admin1CodesASCII.txt once into scripts/.cache/,
keeps cities with population >= MIN_POPULATION plus every national capital,
and writes a compact list the city picker searches:

    [[name, admin1, country_code, iana_tz, population], ...]   (largest first)

Country names come from the browser (Intl.DisplayNames), so they aren't stored.

Usage (from the repo root):  backend/.venv/Scripts/python scripts/build_cities.py
Data: GeoNames, https://www.geonames.org/ (CC BY 4.0)
"""

import csv
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scripts" / ".cache"
OUT = ROOT / "frontend" / "public" / "cities.json"

BASE = "https://download.geonames.org/export/dump/"
CITIES_ZIP = "cities15000.zip"
ADMIN1 = "admin1CodesASCII.txt"

MIN_POPULATION = 150_000

# cities15000.txt columns (tab separated, no header)
NAME, ASCIINAME, FEATURE_CODE, COUNTRY, ADMIN1_CODE, POPULATION, TIMEZONE = 1, 2, 7, 8, 10, 14, 17


def fetch(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print(f"downloading {BASE}{name}")
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "birthday-capsule-build"})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    return path


def load_admin1() -> dict[str, str]:
    names = {}
    with open(fetch(ADMIN1), encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            names[row[0]] = row[1]  # "US.CA" -> "California"
    return names


def main() -> int:
    admin1 = load_admin1()
    with zipfile.ZipFile(fetch(CITIES_ZIP)) as z:
        text = z.read("cities15000.txt").decode("utf-8")

    all_cities, skipped_tz = [], set()
    for row in csv.reader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE):
        tz = row[TIMEZONE]
        try:
            ZoneInfo(tz)  # must exist in the same tz database the engine uses
        except (ZoneInfoNotFoundError, ValueError):
            skipped_tz.add(tz)
            continue
        region = admin1.get(f"{row[COUNTRY]}.{row[ADMIN1_CODE]}", "")
        city = [row[NAME], region, row[COUNTRY], tz, int(row[POPULATION] or 0)]
        all_cities.append((city, row[FEATURE_CODE] == "PPLC"))

    # Keep big cities and capitals, plus the largest city of every time zone so
    # no zone (e.g. America/St_Johns, UTC-3:30) becomes unreachable.
    largest_in_zone: dict[str, list] = {}
    for city, _ in all_cities:
        best = largest_in_zone.get(city[3])
        if best is None or city[4] > best[4]:
            largest_in_zone[city[3]] = city
    keep_ids = {id(c) for c in largest_in_zone.values()}
    cities = [
        city
        for city, is_capital in all_cities
        if city[4] >= MIN_POPULATION or is_capital or id(city) in keep_ids
    ]

    cities.sort(key=lambda c: -c[4])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cities, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    zones = {c[3] for c in cities}
    print(f"wrote {OUT.relative_to(ROOT)}: {len(cities)} cities, {len(zones)} time zones, "
          f"{OUT.stat().st_size / 1024:.0f} KB")
    if skipped_tz:
        print(f"skipped unknown time zones: {sorted(skipped_tz)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
