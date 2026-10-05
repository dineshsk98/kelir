// City → time zone search over public/cities.json (built by scripts/build_cities.py
// from GeoNames, CC BY 4.0). Rows: [name, region, countryCode, ianaTz, population].

type Row = [string, string, string, string, number]

export type City = {
  name: string
  region: string
  country: string
  tz: string
  /** "Chennai, Tamil Nadu, India": what the sender sees and what's saved */
  label: string
}

/** A city already saved with a capsule or person: only its label and time zone are stored */
export const savedCity = (label: string, tz: string): City => ({
  name: label.split(',')[0],
  region: '',
  country: '',
  tz,
  label,
})

type Indexed = City & { key: string; nameKey: string; population: number }

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })

/** Lowercase, accents stripped, so "reykjavik" finds "Reykjavík" */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

let loading: Promise<Indexed[]> | null = null

function load(): Promise<Indexed[]> {
  loading ??= fetch('/cities.json')
    .then((r) => {
      if (!r.ok) throw new Error(`cities.json: ${r.status}`)
      return r.json() as Promise<Row[]>
    })
    .then((rows) =>
      rows.map(([name, region, cc, tz, population]) => {
        const country = countryNames.of(cc) ?? cc
        const parts = [name, region && fold(region) !== fold(name) ? region : '', country]
        const label = parts.filter(Boolean).join(', ')
        return { name, region, country, tz, label, population, nameKey: fold(name), key: fold(label) }
      }),
    )
    .catch((e) => {
      loading = null
      throw e
    })
  return loading
}

/** Best matches for what the sender typed: name prefix first, then other matches; bigger cities first. */
export async function searchCities(query: string, limit = 8): Promise<City[]> {
  const q = fold(query.trim())
  if (!q) return []
  const words = q.split(/[\s,]+/).filter(Boolean)
  const cities = await load()
  const scored: [number, Indexed][] = []
  for (const c of cities) {
    if (!words.every((w) => c.key.includes(w))) continue
    const rank = c.nameKey === q ? 0 : c.nameKey.startsWith(q) ? 1 : c.key.startsWith(words[0]) ? 2 : 3
    scored.push([rank, c])
  }
  scored.sort((a, b) => a[0] - b[0] || b[1].population - a[1].population)
  return scored.slice(0, limit).map(([, { name, region, country, tz, label }]) => ({ name, region, country, tz, label }))
}
