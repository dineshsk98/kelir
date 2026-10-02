// The birthday cake is a real photo (credits in public/reveal/CREDITS.md). To blow its
// candles out, we find the flames in the photo and paint them out on a canvas, once, when
// the page loads: the lit photo is shown first, then it cross-fades to the painted copy.

export type CakeName = 'candles' | 'roses'

export const CAKES: Record<CakeName, { src: string; label: string }> = {
  candles: { src: '/reveal/cake-candles.jpg', label: 'letter candles, dark' },
  roses: { src: '/reveal/cake-roses.jpg', label: 'roses, seven candles' },
}

/** One flame, as fractions of the photo's width and height. */
export type Flame = {
  /** Centre of its bright core */
  x: number
  y: number
  /** Size of the core */
  w: number
  h: number
}

export type PreparedCake = {
  /** Width / height of the photo */
  aspect: number
  flames: Flame[]
  /** The photo with its flames painted out (an object URL) */
  outUrl: string
}

const DETECT_WIDTH = 480 // flames are found on a small copy: fast and plenty precise
const OUT_WIDTH = 960 // the painted copy is never shown larger than this

/** Bright, warm pixels: a flame's core (frosting is bright too, but not this warm). */
function isFlame(r: number, g: number, b: number) {
  return 0.3 * r + 0.59 * g + 0.11 * b > 235 && r - b > 25
}

function findFlames(img: HTMLImageElement): Flame[] {
  const w = DETECT_WIDTH
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w)
  const ctx = canvas(w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  const hit = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) if (isFlame(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])) hit[i] = 1

  // Group touching pixels into blobs
  const boxes: { x0: number; y0: number; x1: number; y1: number; n: number }[] = []
  const seen = new Uint8Array(w * h)
  for (let start = 0; start < w * h; start++) {
    if (!hit[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    const box = { x0: w, y0: h, x1: 0, y1: 0, n: 0 }
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w
      const y = (i / w) | 0
      box.n++
      box.x0 = Math.min(box.x0, x)
      box.x1 = Math.max(box.x1, x + 1)
      box.y0 = Math.min(box.y0, y)
      box.y1 = Math.max(box.y1, y + 1)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          const j = ny * w + nx
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && hit[j] && !seen[j]) {
            seen[j] = 1
            stack.push(j)
          }
        }
    }
    if (box.n >= 3) boxes.push(box)
  }

  // One flame can show up as two pieces: merge boxes that sit almost on top of each other
  const merged: typeof boxes = []
  for (const b of boxes.sort((a, c) => a.x0 - c.x0)) {
    const near = merged.find((m) => Math.abs((m.x0 + m.x1) / 2 - (b.x0 + b.x1) / 2) < w * 0.012)
    if (near) {
      near.x0 = Math.min(near.x0, b.x0)
      near.x1 = Math.max(near.x1, b.x1)
      near.y0 = Math.min(near.y0, b.y0)
      near.y1 = Math.max(near.y1, b.y1)
    } else merged.push({ ...b })
  }
  return merged.map((b) => ({
    x: (b.x0 + b.x1) / 2 / w,
    y: (b.y0 + b.y1) / 2 / h,
    w: (b.x1 - b.x0) / w,
    h: (b.y1 - b.y0) / h,
  }))
}

const lum = (d: Uint8ClampedArray, i: number) => 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]

/** Which pixels around a flame belong to it: grown outwards from the bright core while
 *  pixels stay clearly brighter than the window's surroundings, then widened a little. */
function flameMask(d: Uint8ClampedArray, bw: number, bh: number, core: { x: number; y: number }) {
  // The surroundings: the median brightness along the window's edge
  const edge: number[] = []
  for (let x = 0; x < bw; x++) edge.push(lum(d, x), lum(d, (bh - 1) * bw + x))
  for (let y = 0; y < bh; y++) edge.push(lum(d, y * bw), lum(d, y * bw + bw - 1))
  edge.sort((a, b) => a - b)
  const floor = edge[edge.length >> 1] + 28

  const inside = new Uint8Array(bw * bh)
  const stack = [Math.round(core.y) * bw + Math.round(core.x)]
  while (stack.length) {
    const i = stack.pop()!
    if (inside[i]) continue
    inside[i] = 1
    const x = i % bw
    const y = (i / bw) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      const j = ny * bw + nx
      if (nx > 0 && ny > 0 && nx < bw - 1 && ny < bh - 1 && !inside[j] && lum(d, j) > floor) stack.push(j)
    }
  }
  // Widen by 2 px so the soft rim of the glow goes too
  for (let pass = 0; pass < 2; pass++) {
    const grown = inside.slice()
    for (let y = 1; y < bh - 1; y++)
      for (let x = 1; x < bw - 1; x++) {
        const i = y * bw + x
        if (!inside[i] && (inside[i - 1] || inside[i + 1] || inside[i - bw] || inside[i + bw])) grown[i] = 1
      }
    inside.set(grown)
  }
  return inside
}

/** Fill each flame from its surroundings. */
function paintOut(ctx: CanvasRenderingContext2D, W: number, H: number, flames: Flame[]) {
  for (const f of flames) {
    // A window around the flame: wide enough for its glow, mostly above the core
    const cx = f.x * W
    const cy = f.y * H
    const half = Math.max(f.w * W * 3, W * 0.012)
    const x0 = Math.max(0, Math.floor(cx - half))
    const x1 = Math.min(W, Math.ceil(cx + half))
    const y0 = Math.max(0, Math.floor(cy - Math.max(f.h * H * 3, H * 0.04)))
    const y1 = Math.min(H, Math.ceil(cy + Math.max(f.h * H * 1.5, H * 0.015)))
    const bw = x1 - x0
    const bh = y1 - y0
    if (bw < 5 || bh < 5) continue
    const region = ctx.getImageData(x0, y0, bw, bh)
    const d = region.data
    const inside = flameMask(d, bw, bh, { x: cx - x0, y: cy - y0 })
    // Seed the hole with the average colour just around it (so no glow is left behind),
    // then let the surrounding pixels diffuse inwards for a soft, natural fill
    const sum = [0, 0, 0]
    let ring = 0
    for (let y = 1; y < bh - 1; y++)
      for (let x = 1; x < bw - 1; x++) {
        const i = y * bw + x
        if (inside[i] || !(inside[i - 1] || inside[i + 1] || inside[i - bw] || inside[i + bw])) continue
        for (let c = 0; c < 3; c++) sum[c] += d[i * 4 + c]
        ring++
      }
    for (let i = 0; i < bw * bh; i++)
      if (inside[i]) for (let c = 0; c < 3; c++) d[i * 4 + c] = ring ? sum[c] / ring : d[i * 4 + c]
    for (let pass = 0; pass < 120; pass++)
      for (let y = 1; y < bh - 1; y++)
        for (let x = 1; x < bw - 1; x++) {
          const i = y * bw + x
          if (!inside[i]) continue
          for (let c = 0; c < 3; c++) {
            const k = i * 4 + c
            d[k] = (d[k - 4] + d[k + 4] + d[k - bw * 4] + d[k + bw * 4]) / 4
          }
        }
    ctx.putImageData(region, x0, y0)
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c.getContext('2d', { willReadFrequently: true })!
}

/** Load a cake photo, find its flames and make the blown-out copy. */
export async function prepareCake(src: string): Promise<PreparedCake> {
  const img = new Image()
  img.src = src
  await img.decode()
  const flames = findFlames(img)
  const W = Math.min(OUT_WIDTH, img.naturalWidth)
  const H = Math.round((img.naturalHeight / img.naturalWidth) * W)
  const ctx = canvas(W, H)
  ctx.drawImage(img, 0, 0, W, H)
  paintOut(ctx, W, H, flames)
  const blob = await new Promise<Blob | null>((done) => ctx.canvas.toBlob(done, 'image/jpeg', 0.9))
  if (!blob) throw new Error('could not paint the cake')
  return { aspect: img.naturalWidth / img.naturalHeight, flames, outUrl: URL.createObjectURL(blob) }
}
