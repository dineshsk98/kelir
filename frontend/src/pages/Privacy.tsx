import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type PublicConfig } from '../api'
import { Wordmark } from '../components/Wordmark'
import './Privacy.css'

// The policy text lives here, so editing the wording means editing this file only.
// Keep every line true to the code: if the app changes what it stores or who it talks to, change it here.
const EFFECTIVE = '24 October 2026'

type Section = { title: string; body: React.ReactNode }

// The contact address and the hosting location come from the server's settings (GET /v1/config)
function sections({ support_email, hosting_location }: PublicConfig): Section[] {
  const contact = support_email ? <a href={`mailto:${support_email}`}>{support_email}</a> : 'the person who runs this site'
  return [
    {
      title: 'Who runs Kelir',
      body: (
        <p>
          Kelir is a small hackathon project that delivers birthday capsules by email. For any question about
          this page or your data, write to {contact}.
        </p>
      ),
    },
    {
      title: 'What we store',
      body: (
        <>
          <p>
            <strong>If you have an account</strong> (you sign in to send or to open a capsule): your email address
            and your name. If you use Google sign-in, also your Google account ID and the name and email Google
            shares with us. We never see your Google password.
          </p>
          <p>
            <strong>For each capsule you make:</strong> the recipient's name and email address, their birthday
            (day and month), their city and time zone, your message text and its language, the photos, voice
            recordings and videos you add, and a gift link or code with a short note if you add one. We also
            keep when it is due, whether it was delivered, emailed and opened, and when. People you send to are
            saved in your People list.
          </p>
          <p>
            <strong>Thank-you replies:</strong> if a recipient replies, we store the reply they chose or wrote.
          </p>
          <p>
            <strong>Sign-in codes:</strong> a code we email you is stored only as a keyed hash, not as the code
            itself. It works for 10 minutes and for five tries. Used or expired code records are not cleared
            automatically yet.
          </p>
        </>
      ),
    },
    {
      title: 'What we use it for',
      body: (
        <p>
          Only to run Kelir: to send each capsule at the recipient's local midnight, to let the recipient open it
          after signing in with the email it was sent to, to show your sent and received capsules, and to email
          sign-in codes. There are no ads, we do not sell or share your data, and we do not profile anyone.
        </p>
      ),
    },
    {
      title: 'Email',
      body: (
        <p>
          Emails (the birthday email and sign-in codes) are sent through Gmail from the app's own account. That
          means the sender's and recipient's email addresses and the email's content pass through Google's mail
          systems.
        </p>
      ),
    },
    {
      title: 'Cookies and third parties',
      body: (
        <>
          <p>
            Kelir sets one cookie, a sign-in cookie that keeps you signed in. It is removed when you close your
            browser, and the sign-in ends after 12 hours in any case. It is needed for the app to work, so there
            is no cookie banner.
          </p>
          <p>
            There are no analytics, advertising or tracking tools. Fonts, images and scripts come from Kelir's own
            server. The one other site your browser contacts is Google, when a sign-in screen is shown: it loads
            Google's sign-in script (from accounts.google.com) for the "Continue with Google" button, and
            Google's own privacy policy applies to that. If a capsule has a gift link, your browser goes to that
            site only if you choose to open it.
          </p>
          <p>Like any web server, ours keeps ordinary logs of requests, which can include IP addresses and times.</p>
        </>
      ),
    },
    {
      title: 'Where it is stored',
      body: (
        <p>
          On one server{hosting_location ? ` (${hosting_location})` : ''}: text and details in a database, and uploaded
          photos, audio and video as files on that server's disk. Traffic between your browser and Kelir is
          encrypted with HTTPS.
        </p>
      ),
    },
    {
      title: 'Who can see a capsule',
      body: (
        <p>
          Only the person who made it and the person it is addressed to. The recipient's link alone shows
          nothing inside: they must also sign in with the email address the capsule was sent to.
        </p>
      ),
    },
    {
      title: 'Keeping and deleting',
      body: (
        <>
          <p>
            Cancelling a capsule before it is opened stops its delivery and makes its link say it is no longer
            available, but its details and files stay stored. Removing a photo, recording or video from a capsule
            you are editing deletes that file. Removing someone from your People list removes that saved entry;
            capsules already made to them stay. Files you upload but never put in a capsule are deleted after a
            day.
          </p>
          <p>
            There is no way to delete your account in the app yet. To have your account and data deleted, write
            to {contact} from the email address concerned. This
            includes recipients who want a capsule sent to them removed.
          </p>
        </>
      ),
    },
    {
      title: 'Children',
      body: <p>Kelir is not directed at children under 13.</p>,
    },
    {
      title: 'Changes',
      body: <p>If this policy changes, the new version will be shown on this page with a new date at the top.</p>,
    },
  ]
}

export function Privacy() {
  // null while asking; if the server can't be reached the page still reads correctly without them
  const [config, setConfig] = useState<PublicConfig | null>(null)
  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => setConfig({ google_client_id: '', demo_mode: false, support_email: '', hosting_location: '' }))
  }, [])

  return (
    <main className="page privacy">
      <header className="topbar">
        <Link to="/" className="brand">
          <Wordmark className="wordmark-sm" />
        </Link>
      </header>
      <h1>Privacy policy</h1>
      <p className="muted small">Effective {EFFECTIVE}</p>
      {config && sections(config).map((s) => (
        <section key={s.title} className="privacy-section">
          <h2>{s.title}</h2>
          {s.body}
        </section>
      ))}
    </main>
  )
}
