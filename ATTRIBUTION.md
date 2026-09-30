# Attribution

## City data

`frontend/public/cities.json` is derived from [GeoNames](https://www.geonames.org/)
(`cities15000` and `admin1CodesASCII`), licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
It was filtered and reformatted by `scripts/build_cities.py`: cities of 150,000+
people, national capitals, and the largest city in each time zone, keeping only
name, region, country code, IANA time zone and population.
