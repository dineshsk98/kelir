// The photocard: original art drawn on a canvas, with her name written on it live, in the
// capsule's language and handwriting. The canvas becomes the texture on the 3D card.
// Every capsule gets the default night-sky card; when the sender chose one of their photos, that
// photo takes its place: the card is portrait for a tall (or square) photo and landscape for a
// wide one, with the words in a strip underneath so they never cover a face.

import { loadHandFont, type MessageLang } from '../languages'
import { RECIPIENT_COPY } from '../recipientCopy'

const W = 640
const H = 794

/** Writes `text` centred at (x, y), shrinking the font until it fits `maxWidth`. */
function fitText(
  g: CanvasRenderingContext2D,
  family: string,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
) {
  let px = size
  do {
    g.font = `700 ${px}px ${family}`
    px -= 2
  } while (g.measureText(text).width > maxWidth && px > 20)
  g.fillText(text, x, y)
}

/** A card's size in the 3D scene, from its canvas's proportions. */
export function cardSize(canvas: { width: number; height: number }): [number, number] {
  const ratio = canvas.width / canvas.height
  // A portrait card is as tall as the default one; a landscape card a little wider than the
  // default is, so neither outgrows the box
  return ratio <= 1 ? [1.24 * ratio, 1.24] : [1.2, 1.2 / ratio]
}

export async function drawPhotocard(
  name: string,
  sender: string,
  lang: MessageLang,
  photoUrl?: string,
): Promise<HTMLCanvasElement> {
  if (photoUrl) {
    const photo = await loadPhoto(photoUrl)
    if (photo) return drawPhotoCard(photo, name, sender, lang)
  }
  return drawDefaultCard(name, sender, lang)
}

function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null)
    img.onerror = () => resolve(null) // it did not load: the default card instead
    img.src = url
  })
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** The sender's photo on a card: the card's shape follows the photo's. */
async function drawPhotoCard(
  photo: HTMLImageElement,
  name: string,
  sender: string,
  lang: MessageLang,
): Promise<HTMLCanvasElement> {
  const copy = RECIPIENT_COPY[lang]
  const words = [copy.cardHappyBirthday, name, copy.from(sender)]
  const family = await loadHandFont(lang, words.join(''))

  const ratio = photo.naturalWidth / photo.naturalHeight
  const landscape = ratio > 1 // wider than tall: a landscape card; square and tall: portrait
  const M = 28 // the card's border
  const W = landscape ? 900 : 640
  const strip = landscape ? 165 : 190 // the words, under the photo
  const pw = W - 2 * M
  // The photo's own shape, kept within limits so the card stays a card. A landscape card is
  // never made too tall to be landscape: a nearly square photo gets blurred sides instead.
  const boxRatio = landscape ? clamp(ratio, 1.3, 1.8) : clamp(ratio, 0.7, 1)
  const ph = Math.round(pw / boxRatio)
  const H = M + ph + strip

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return c

  g.fillStyle = '#f7f1e6'
  g.fillRect(0, 0, W, H)

  // The photo, whole and never stretched. What the box has left over is a soft blur of the
  // same photo (or a dark fill where the browser can't blur) rather than empty bars.
  g.save()
  g.beginPath()
  g.rect(M, M, pw, ph)
  g.clip()
  g.fillStyle = '#2a2230'
  g.fillRect(M, M, pw, ph)
  if (Math.abs(ratio - pw / ph) > 0.01 && 'filter' in g) {
    const cover = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight)
    const cw = photo.naturalWidth * cover
    const ch = photo.naturalHeight * cover
    g.filter = 'blur(24px)'
    g.drawImage(photo, M + (pw - cw) / 2, M + (ph - ch) / 2, cw, ch)
    g.filter = 'none'
    g.fillStyle = 'rgba(42, 34, 48, 0.35)'
    g.fillRect(M, M, pw, ph)
  }
  const fit = Math.min(pw / photo.naturalWidth, ph / photo.naturalHeight)
  const dw = photo.naturalWidth * fit
  const dh = photo.naturalHeight * fit
  g.drawImage(photo, M + (pw - dw) / 2, M + (ph - dh) / 2, dw, dh)
  g.restore()

  // The words, in the strip under the photo
  const top = M + ph
  g.textAlign = 'center'
  const sizes = landscape ? [36, 54, 30] : [40, 58, 30]
  const ys = landscape ? [top + 44, top + 100, top + 146] : [top + 56, top + 118, top + 166]
  g.fillStyle = '#3a2a30'
  fitText(g, family, words[0], W / 2, ys[0], sizes[0], pw - 40)
  g.fillStyle = '#b8405c'
  fitText(g, family, words[1], W / 2, ys[1], sizes[1], pw - 40)
  g.fillStyle = '#6b5a5f'
  fitText(g, family, words[2], W / 2, ys[2], sizes[2], pw - 40)
  return c
}

async function drawDefaultCard(name: string, sender: string, lang: MessageLang): Promise<HTMLCanvasElement> {
  const copy = RECIPIENT_COPY[lang]
  const words = [copy.cardHappyBirthday, name, copy.from(sender)]
  const family = await loadHandFont(lang, words.join(''))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return c

  // The card itself
  g.fillStyle = '#f7f1e6'
  g.fillRect(0, 0, W, H)

  // The photo area: a night sky
  const px = 32
  const py = 32
  const pw = W - 64
  const ph = 600
  const sky = g.createLinearGradient(0, py, 0, py + ph)
  sky.addColorStop(0, '#1c2340')
  sky.addColorStop(0.55, '#3d3260')
  sky.addColorStop(1, '#b8405c')
  g.fillStyle = sky
  g.fillRect(px, py, pw, ph)

  // Stars at fixed spots, so every card looks the same
  g.fillStyle = '#ffffff'
  for (const [sx, sy, r] of [[80, 70, 2], [190, 120, 1.5], [300, 60, 2], [420, 150, 1.5], [120, 200, 1.5], [520, 230, 2]]) {
    g.beginPath()
    g.arc(px + sx, py + sy, r, 0, Math.PI * 2)
    g.fill()
  }

  // The moon
  g.save()
  g.shadowColor = 'rgba(247, 231, 196, 0.8)'
  g.shadowBlur = 40
  g.fillStyle = '#f7e7c4'
  g.beginPath()
  g.arc(px + pw - 110, py + 100, 46, 0, Math.PI * 2)
  g.fill()
  g.restore()

  // A string of lights across the sky
  g.strokeStyle = 'rgba(247, 241, 230, 0.35)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(px, py + 240)
  g.quadraticCurveTo(px + pw / 2, py + 330, px + pw, py + 240)
  g.stroke()
  const bulbs = ['#f2b45a', '#e88ba0', '#8fb8ff']
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    const bx = px + u * pw
    const by = py + 240 + 2 * u * (1 - u) * 90 // the same curve as the string
    g.save()
    g.shadowColor = bulbs[i % 3]
    g.shadowBlur = 18
    g.fillStyle = bulbs[i % 3]
    g.beginPath()
    g.arc(bx, by + 8, 7, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  // Her name, written live
  g.textAlign = 'center'
  g.fillStyle = '#f7f1e6'
  fitText(g, family, words[0], W / 2, py + 430, 76, pw - 60)
  g.fillStyle = '#ffcf7a'
  fitText(g, family, name, W / 2, py + 520, 84, pw - 60)

  // The white strip at the bottom
  g.fillStyle = '#3a2a30'
  fitText(g, family, words[2], W / 2, H - 52, 48, pw - 60)
  return c
}
