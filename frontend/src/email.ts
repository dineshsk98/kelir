// Recipient email helpers: the same format rule as the API (backend/app/email_check.py)
// and a "did you mean…?" suggestion for common domain typos.

const EMAIL_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export function isValidEmail(email: string): boolean {
  const [local = ''] = email.split('@')
  return email.length <= 254 && local.length <= 64 && EMAIL_RE.test(email)
}

const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'rediffmail.com',
]

// Mistyped endings, for domains we don't know by name
const TLD_FIXES: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  comm: 'com',
  vom: 'com',
  xom: 'com',
  coom: 'com',
  nte: 'net',
  ner: 'net',
  ogr: 'org',
  orh: 'org',
  'co.ik': 'co.uk',
}

/** Edit distance counting a swap of neighbouring letters as one edit ("gmial" → "gmail") */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** A likely intended address, e.g. "aiko@gmial.com" → "aiko@gmail.com"; null if it looks fine. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()
  if (!domain.includes('.') || COMMON_DOMAINS.includes(domain)) return null

  let best: string | null = null
  let bestDistance = Infinity
  for (const known of COMMON_DOMAINS) {
    const dist = distance(domain, known)
    if (dist < bestDistance) {
      best = known
      bestDistance = dist
    }
  }
  // One slip for short domains, two for longer ones
  if (best && bestDistance <= (domain.length < 8 ? 1 : 2)) return `${local}@${best}`

  for (const [typo, fix] of Object.entries(TLD_FIXES)) {
    if (domain.endsWith(`.${typo}`)) return `${local}@${domain.slice(0, -typo.length)}${fix}`
  }
  return null
}
