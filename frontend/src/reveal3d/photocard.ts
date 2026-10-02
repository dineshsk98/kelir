// The default photocard every capsule gets: original art drawn on a canvas, with her name
// written on it live. The canvas becomes the texture on the 3D card.

const W = 640
const H = 794

/** Writes `text` centred at (x, y), shrinking the font until it fits `maxWidth`. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number) {
  let px = size
  do {
    g.font = `700 ${px}px Caveat, cursive`
    px -= 2
  } while (g.measureText(text).width > maxWidth && px > 20)
  g.fillText(text, x, y)
}

export async function drawPhotocard(name: string, sender: string): Promise<HTMLCanvasElement> {
  try {
    await document.fonts.load('700 64px Caveat')
  } catch {
    // the system's cursive font is a fine fallback
  }
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
  fitText(g, 'Happy birthday', W / 2, py + 430, 76, pw - 60)
  g.fillStyle = '#ffcf7a'
  fitText(g, name, W / 2, py + 520, 84, pw - 60)

  // The white strip at the bottom
  g.fillStyle = '#3a2a30'
  fitText(g, `from ${sender}`, W / 2, H - 52, 48, pw - 60)
  return c
}
