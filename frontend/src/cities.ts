// City → time zone search over public/cities.json (built by scripts/build_cities.py
// from GeoNames, CC BY 4.0). Rows: [name, region, countryCode, ianaTz, population].

import { PrefixIndex, words } from './prefixIndex'

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

/** What people type instead of the name in our data: abbreviations, and former or local names.
 *  alias → city name as it appears in cities.json */
const ALIASES: Record<string, string> = {
  nyc: 'New York City',
  ny: 'New York City',
  'new york': 'New York City',
  la: 'Los Angeles',
  sf: 'San Francisco',
  dc: 'Washington',
  vegas: 'Las Vegas',
  philly: 'Philadelphia',
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  madras: 'Chennai',
  calcutta: 'Kolkata',
  cochin: 'Kochi',
  trivandrum: 'Thiruvananthapuram',
  mysore: 'Mysuru',
  benares: 'Varanasi',
  gurgaon: 'Gurugram',
  baroda: 'Vadodara',
  poona: 'Pune',
  saigon: 'Ho Chi Minh City',
  hcmc: 'Ho Chi Minh City',
  peking: 'Beijing',
  canton: 'Guangzhou',
  rangoon: 'Yangon',
  kiev: 'Kyiv',
  cdmx: 'Mexico City',
  constantinople: 'Istanbul',
}
const aliasTargets = Object.entries(ALIASES).map(([alias, name]) => [fold(alias), fold(name)] as const)

type Index = { cities: Indexed[]; trie: PrefixIndex; byName: Map<string, number[]> }

let loading: Promise<Index> | null = null

function load(): Promise<Index> {
  loading ??= fetch('/cities.json')
    .then((r) => {
      if (!r.ok) throw new Error(`cities.json: ${r.status}`)
      return r.json() as Promise<Row[]>
    })
    .then((rows) => {
      const cities = rows
        .map(([name, region, cc, tz, population]) => {
          const country = countryNames.of(cc) ?? cc
          const parts = [name, region && fold(region) !== fold(name) ? region : '', country]
          const label = parts.filter(Boolean).join(', ')
          return { name, region, country, tz, label, population, nameKey: fold(name), key: fold(label) }
        })
        // Biggest first, so a city's position is its rank among equals (and ids go in ascending order)
        .sort((a, b) => b.population - a.population)
      const trie = new PrefixIndex()
      const byName = new Map<string, number[]>()
      cities.forEach((c, id) => {
        trie.add(id, c.key)
        byName.set(c.nameKey, [...(byName.get(c.nameKey) ?? []), id])
      })
      return { cities, trie, byName }
    })
    .catch((e) => {
      loading = null
      throw e
    })
  return loading
}

/** Best matches for what the sender typed: name prefix first, then other matches; bigger cities first.
 *  Every typed word must start a word of the city's label ("new yo" finds New York City). */
export async function searchCities(query: string, limit = 8): Promise<City[]> {
  const q = fold(query.trim())
  if (!q) return []
  const typed = words(q)
  const { cities, trie, byName } = await load()
  // "nyc", "bangalore", or the start of one ("banga"): that city's names rank first
  const aliased = new Set(
    aliasTargets
      .filter(([alias]) => alias === q || (q.length >= 3 && alias.startsWith(q)))
      .flatMap(([, name]) => byName.get(name) ?? []),
  )
  const ids = [...new Set([...aliased, ...trie.search(typed)])]
  const scored = ids.map((id): [number, number] => {
    const c = cities[id]
    const rank = aliased.has(id) || c.nameKey === q ? 0 : c.nameKey.startsWith(q) ? 1 : c.key.startsWith(typed[0]) ? 2 : 3
    return [rank, id]
  })
  // Ids run biggest city first, so the id breaks ties by population
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return scored.slice(0, limit).map(([, id]) => {
    const { name, region, country, tz, label } = cities[id]
    return { name, region, country, tz, label }
  })
}
