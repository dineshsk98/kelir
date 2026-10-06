# Attribution

## City data

`frontend/public/cities.json` is derived from [GeoNames](https://www.geonames.org/)
(`cities15000` and `admin1CodesASCII`), licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
It was filtered and reformatted by `scripts/build_cities.py`: cities of 150,000+
people, national capitals, and the largest city in each time zone, keeping only
name, region, country code, IANA time zone and population.

## Fonts

All bundled through [Fontsource](https://fontsource.org/) npm packages and licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/). Each package includes its full licence.

| Font | Used for | Copyright |
| --- | --- | --- |
| Nunito | the app's text | 2014 The Nunito Project Authors |
| Caveat | handwritten messages: English, Spanish, French, Italian, German | 2014 The Caveat Project Authors |
| Nanum Pen Script | Korean messages | 2010 NHN Corporation, designed by Sandoll Communications |
| Ma Shan Zheng | Chinese messages | 2018 The MaShanZheng Project Authors |
| Yomogi | Japanese messages | 2020 The Yomogi Project Authors |
| Kavivanar | Tamil messages | 2015 Tharique Azeez |
| Kalam | Hindi messages | 2014 Indian Type Foundry |

## Logo

The Tamil lettering in the Kelir logo (`frontend/public/brand/kelir-wordmark-3d.svg`, the header
wordmark in `frontend/src/components/Wordmark.tsx`, and the favicon) is drawn from the outlines of
**Baloo Thambi 2** ExtraBold, copyright 2019 The Baloo 2 Project Authors
([github.com/EkType/Baloo2](https://github.com/EkType/Baloo2)), licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/). The letter outlines were converted to
vector paths and the thread, nodes and sparkle were added; the font itself is not bundled.

## Photos

The three photos in `frontend/public/reveal/` are public domain (CC0 1.0) from Wikimedia Commons.
Credits for each are in [`frontend/public/reveal/CREDITS.md`](frontend/public/reveal/CREDITS.md).

## Name and logo

The code is licensed as stated in `LICENSE`. The name "Kelir" and its logo are not licensed for
reuse: please don't use them to name or brand another product or service.
