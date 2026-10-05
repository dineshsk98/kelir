// A prefix trie over the words of each entry's text: "new york city" is stored under
// "new", "york" and "city", so a search for "york" or "new yo" finds it. Each node keeps
// the ids of every entry whose words pass through it, in ascending order, so a lookup is
// one walk down the typed letters instead of a pass over all entries.

type Node = { kids: Map<string, Node>; ids: number[] }

const newNode = (): Node => ({ kids: new Map(), ids: [] })

/** Lowercase letters and digits only: "Côte d'Ivoire" → ["cote", "d", "ivoire"] (after fold) */
export const words = (folded: string) => folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean)

export class PrefixIndex {
  private root = newNode()

  /** Add entries with ascending ids (the order they're indexed in) */
  add(id: number, folded: string) {
    for (const word of words(folded)) {
      let node = this.root
      for (const ch of word) {
        let next = node.kids.get(ch)
        if (!next) node.kids.set(ch, (next = newNode()))
        node = next
        // Ascending ids: a repeat can only be the last one (two words of one entry sharing a prefix)
        if (node.ids[node.ids.length - 1] !== id) node.ids.push(id)
      }
    }
  }

  /** Ids (ascending) of entries that have, for every typed word, a word starting with it */
  search(typed: string[]): number[] {
    const lists: number[][] = []
    for (const word of typed) {
      let node: Node | undefined = this.root
      for (const ch of word) node = node?.kids.get(ch)
      if (!node) return []
      lists.push(node.ids)
    }
    if (lists.length === 0) return []
    lists.sort((a, b) => a.length - b.length)
    return lists.reduce(intersect)
  }
}

/** Both lists ascending */
function intersect(a: number[], b: number[]): number[] {
  const out: number[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) out.push(a[i++]), j++
    else if (a[i] < b[j]) i++
    else j++
  }
  return out
}
