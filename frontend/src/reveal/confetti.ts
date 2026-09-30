// Canvas confetti driven by requestAnimationFrame. Per-frame values stay in plain
// objects (never React state), so the animation doesn't re-render components.

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  angle: number
  spin: number
  color: string
  shape: 'rect' | 'circle'
}

const GRAVITY = 900 // px/s²
const DRAG = 0.985
const LIFETIME_MS = 3200

/** Burst confetti from (originX, originY) as fractions of the canvas. Returns a stop function. */
export function burstConfetti(
  canvas: HTMLCanvasElement,
  colors: string[],
  { count = 160, originX = 0.5, originY = 0.45 } = {},
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 350 + Math.random() * 650
    return {
      x: w * originX,
      y: h * originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 350,
      size: 6 + Math.random() * 7,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
      shape: Math.random() < 0.7 ? 'rect' : 'circle',
    }
  })

  const start = performance.now()
  let last = start
  let frame = 0

  const draw = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const age = now - start
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    ctx.globalAlpha = age > LIFETIME_MS - 800 ? Math.max(0, (LIFETIME_MS - age) / 800) : 1
    for (const p of pieces) {
      p.vx *= DRAG
      p.vy = p.vy * DRAG + GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.angle += p.spin * dt
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    if (age < LIFETIME_MS) frame = requestAnimationFrame(draw)
    else ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  }
  frame = requestAnimationFrame(draw)

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  }
}

/** The theme's confetti colors, from the --confetti token ("#a, #b, ..."). */
export function themeConfettiColors(el: Element): string[] {
  const raw = getComputedStyle(el).getPropertyValue('--confetti')
  const colors = raw.split(',').map((c) => c.trim()).filter(Boolean)
  return colors.length ? colors : ['#e8604c', '#ffcf5c', '#7cc6a4', '#6aa8ff']
}
