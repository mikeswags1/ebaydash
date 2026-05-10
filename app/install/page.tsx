import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Install StackPilot — Add to home screen',
  description: 'Install StackPilot as an app on iPhone, Android, or desktop (PWA). No App Store required.',
}

const steps = [
  {
    title: 'What this means',
    bullets: [
      'StackPilot runs in your browser. Installing adds it to your home screen or app list so it opens like a normal app.',
      'There is nothing to download from the App Store or Play Store — this is a progressive web app (PWA).',
    ],
  },
  {
    title: 'iPhone & iPad (Safari)',
    bullets: ['Tap the Share button → Add to Home Screen → confirm. Open StackPilot from the new icon on your home screen.'],
  },
  {
    title: 'Android (Chrome)',
    bullets: ['Tap the menu (⋮) → Install app or Add to Home screen. Follow the prompt, then open from your app drawer or home screen.'],
  },
  {
    title: 'Desktop (Chrome or Edge)',
    bullets: [
      'Open the ⋮ menu → Save and share → Install page as app (wording may vary slightly).',
      'Or use the Install icon in the address bar when the browser offers it.',
    ],
  },
] as const

export default function InstallPage() {
  return (
    <main className="home-page guide-page">
      <nav className="home-nav">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div className="home-nav-links" aria-label="Install help">
          <Link href="/guide">Full manual</Link>
        </div>
        <div className="home-nav-actions">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign In
          </Link>
          <Link href="/dashboard" className="btn btn-solid btn-sm">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="guide-hero">
        <div className="home-kicker">
          <span />
          Install
        </div>
        <h1>Add StackPilot to your device</h1>
        <p className="guide-lead">Quick steps for home screen / desktop install. Not the same as the product manual — that&apos;s on the full guide.</p>
        <div className="guide-hero-actions">
          <Link href="/dashboard" className="btn btn-solid">
            Open dashboard
          </Link>
          <Link href="/guide" className="btn btn-ghost">
            How to use StackPilot
          </Link>
        </div>
      </section>

      <div className="guide-stack">
        {steps.map((sec) => (
          <section key={sec.title} className="guide-card">
            <h2>{sec.title}</h2>
            <ul>
              {sec.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="guide-card guide-card--muted">
          <h2>After you install</h2>
          <ul>
            <li>
              Sign in from the icon like any app. Your account and eBay connection are the same as in the browser.
            </li>
            <li>
              If the install button doesn&apos;t appear, use StackPilot in the browser — everything still works.
            </li>
          </ul>
        </section>
      </div>

      <footer className="home-footer">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div>
          <Link href="/dashboard">Dashboard</Link>
          <span aria-hidden> · </span>
          <Link href="/guide">Guide</Link>
        </div>
      </footer>
    </main>
  )
}
