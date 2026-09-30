import { useEffect, useState } from 'react'
import { Reveal, type RevealCapsule } from '../reveal/Reveal'
import { APP_THEME, applyTheme, THEMES, type Theme } from '../theme'
import './DevReveal.css'

// Development only (not in production builds): tune the opening and compare looks
// with labeled sample data. No API, database or sign-in involved.
const SAMPLES: Record<string, RevealCapsule> = {
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

  useEffect(() => {
    applyTheme(theme)
    return () => applyTheme(APP_THEME)
  }, [theme])

  return (
    <>
      <div className="dev-bar" role="toolbar" aria-label="Opening preview controls">
        <strong>/dev/reveal · sample data</strong>
        <label>
          Look{' '}
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            {THEMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
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
      </div>
      <Reveal
        key={`${run}-${sample}-${reduced}-${theme}`}
        capsule={SAMPLES[sample]}
        replyPanel={SAMPLE_REPLY}
        reducedMotion={reduced === 'device' ? undefined : reduced === 'on'}
      />
    </>
  )
}
