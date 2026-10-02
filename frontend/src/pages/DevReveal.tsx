import { useEffect, useState } from 'react'
import type { GalleryItem } from '../components/MediaGallery'
import { Reveal, type RevealCapsule } from '../reveal/Reveal'
import type { BackdropPhoto } from '../reveal3d/Backdrop'
import { Reveal3D } from '../reveal3d/Reveal3D'
import { APP_THEME, applyTheme, THEMES, type Theme } from '../theme'
import { sampleVideo, sampleVoiceNote } from './devSamples'
import './DevReveal.css'

// Development only (not in production builds): tune the opening and compare looks
// with labeled sample data. No API, database or sign-in involved.
/** A generated placeholder "photo" (inline SVG), clearly labelled as a sample */
const samplePhoto = (label: string, from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
      `<rect width="800" height="600" fill="url(#g)"/><text x="400" y="320" font-size="56" text-anchor="middle" ` +
      `fill="#fff" font-family="sans-serif">${label}</text></svg>`,
  )}`

const SAMPLES: Record<string, RevealCapsule> = {
  'Text + photos + gift code': {
    senderName: 'Sam (sample)',
    recipientName: 'Aiko (sample)',
    messageText: 'Remember these?',
    media: [
      { key: 'p1', kind: 'image', url: samplePhoto('Sample photo 1', '#ff8a6b', '#ffcf5c') },
      { key: 'p2', kind: 'image', url: samplePhoto('Sample photo 2', '#6aa8ff', '#b8a4ff') },
      { key: 'p3', kind: 'image', url: samplePhoto('Sample photo 3', '#7cc6a4', '#2c7a5b') },
    ],
    gift: { kind: 'code', value: 'SAMPLE-1234-ABCD', note: 'For the new game!' },
  },
  // Its media is made in the browser when picked (see MEDIA_SAMPLE below)
  'Voice note + video + photo': {
    senderName: 'Sam (sample)',
    recipientName: 'Aiko (sample)',
    messageText: 'Press play, I recorded something for you!',
  },
  'Text + gift code': {
    senderName: 'Sam (sample)',
    recipientName: 'Aiko (sample)',
    messageText: 'Happy birthday Aiko!\nWish I could be there for the first minute of your day.',
    gift: { kind: 'code', value: 'SAMPLE-1234-ABCD', note: 'For the new game!' },
  },
  'Text + gift link': {
    senderName: 'Sam (sample)',
    recipientName: 'Aiko (sample)',
    messageText: 'Happy birthday! Something small is on its way to you.',
    gift: { kind: 'link', value: 'https://example.com/sample-gift', note: 'Your gift is on its way' },
  },
  'Text only': {
    senderName: 'Sam (sample)',
    recipientName: 'Aiko (sample)',
    messageText: 'Happy birthday!',
  },
  'Long message': {
    senderName: 'Sam (sample)',
    recipientName: 'Aiko (sample)',
    messageText:
      'Another year of you, and the world is better for it. I remember the night we got lost looking for ' +
      'that little noodle place and ended up laughing for an hour on the wrong side of town. Here is to many ' +
      'more wrong turns together. Happy birthday!',
  },
}

const MEDIA_SAMPLE = 'Voice note + video + photo'

const SAMPLE_REPLY = (
  <section className="reply-panel">
    <h2>Say thank you to Sam</h2>
    <p className="muted small" style={{ textAlign: 'center' }}>
      (Sample reply panel: the real one appears on capsule links.)
    </p>
  </section>
)

export function DevReveal() {
  const [theme, setTheme] = useState<Theme>(APP_THEME)
  const [sample, setSample] = useState(Object.keys(SAMPLES)[0])
  const [reduced, setReduced] = useState<'device' | 'on' | 'off'>('device')
  const [run, setRun] = useState(0)
  const [version, setVersion] = useState<'3d' | 'v1'>('3d')
  const [backdrop, setBackdrop] = useState<BackdropPhoto>('colour')
  const [barOpen, setBarOpen] = useState(true)
  const [recorded, setRecorded] = useState<GalleryItem[] | null>(null)

  useEffect(() => {
    applyTheme(theme)
    return () => applyTheme(APP_THEME)
  }, [theme])

  // The media sample's video takes a few seconds to record, once per page load
  const needsMedia = sample === MEDIA_SAMPLE && !recorded
  useEffect(() => {
    if (!needsMedia) return
    let live = true
    sampleVideo().then((video) => {
      if (!live) return
      setRecorded([
        { key: 'a1', kind: 'audio', url: sampleVoiceNote() },
        { key: 'v1', kind: 'video', url: video },
        { key: 'p1', kind: 'image', url: samplePhoto('Sample photo', '#ff8a6b', '#ffcf5c') },
      ])
    })
    return () => {
      live = false
    }
  }, [needsMedia])

  const key = `${run}-${sample}-${reduced}-${theme}-${version}-${backdrop}`
  const reducedMotion = reduced === 'device' ? undefined : reduced === 'on'
  const capsule = sample === MEDIA_SAMPLE ? { ...SAMPLES[sample], media: recorded ?? [] } : SAMPLES[sample]

  return (
    <>
      {/* The bar can hide so it doesn't cover the opening's own buttons on a phone */}
      {!barOpen ? (
        <button type="button" className="dev-bar-open" onClick={() => setBarOpen(true)}>
          dev
        </button>
      ) : (
        <div className="dev-bar" role="toolbar" aria-label="Opening preview controls">
          <strong>/dev/reveal · sample data</strong>
          <label>
            Version{' '}
            <select value={version} onChange={(e) => setVersion(e.target.value as typeof version)}>
              <option value="3d">3D gift box</option>
              <option value="v1">v1 capsule</option>
            </select>
          </label>
          {version === '3d' ? (
            <label>
              Backdrop{' '}
              <select value={backdrop} onChange={(e) => setBackdrop(e.target.value as BackdropPhoto)}>
                <option value="colour">colourful bokeh</option>
                <option value="warm">warm + blue bokeh</option>
              </select>
            </label>
          ) : (
            <label>
              Look{' '}
              <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Sample{' '}
            <select value={sample} onChange={(e) => setSample(e.target.value)}>
              {Object.keys(SAMPLES).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Reduced motion{' '}
            <select value={reduced} onChange={(e) => setReduced(e.target.value as typeof reduced)}>
              <option value="device">device setting</option>
              <option value="on">on</option>
              <option value="off">off</option>
            </select>
          </label>
          <button type="button" onClick={() => setRun((r) => r + 1)}>
            Replay
          </button>
          <button type="button" onClick={() => setBarOpen(false)}>
            Hide
          </button>
        </div>
      )}
      {needsMedia ? (
        <p className="dev-making">Recording the sample video…</p>
      ) : version === '3d' ? (
        <Reveal3D key={key} capsule={capsule} replyPanel={SAMPLE_REPLY} reducedMotion={reducedMotion} backdrop={backdrop} />
      ) : (
        <Reveal key={key} capsule={capsule} replyPanel={SAMPLE_REPLY} reducedMotion={reducedMotion} />
      )}
    </>
  )
}
