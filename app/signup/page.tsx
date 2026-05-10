'use client'

import Link from 'next/link'
import { GetTheAppBanner } from '@/app/components/GetTheAppBanner'

const betaNotes = [
  'Invite-only while onboarding is finalized',
  'Listing review, catalog research, and seller operations',
  'Approved users can sign in and connect eBay',
  'Trial: list up to 5 items free (no card)',
]

const betaChecks = [
  'Listing quality checks',
  'Seller performance views',
  'Financial tracking',
  'Queue management',
]

export default function Signup() {
  return (
    <main className="access-page">
      <nav className="access-nav">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <Link href="/login" className="btn btn-ghost btn-sm">
          Sign In
        </Link>
      </nav>

      <section className="access-shell">
        <div className="access-shell__install-hint">
          <GetTheAppBanner variant="marketing" />
        </div>
        <div className="access-copy">
          <div className="home-kicker">
            <span />
            Private beta
          </div>
          <h1>Private beta access.</h1>
          <p>
            StackPilot is currently invite-only while we finish launch readiness,
            onboarding, and account-safety workflows for sellers.
          </p>

          <div className="access-note-list">
            {betaNotes.map((note) => (
              <div key={note}>
                <span />
                {note}
              </div>
            ))}
          </div>
          <p style={{ marginTop: '18px', fontSize: '14px' }}>
            <Link href="/guide" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>
              How StackPilot works →
            </Link>
          </p>
        </div>

        <div className="access-card" aria-label="Private beta signup status">
          <div className="access-status">
            <span>Beta status</span>
            <strong>Request access</strong>
            <p>
              New self-serve accounts are paused for now. Approved beta users can
              continue directly to the dashboard sign-in.
            </p>
          </div>

          <div className="access-check-grid">
            {betaChecks.map((check) => (
              <div key={check}>{check}</div>
            ))}
          </div>

          <Link href="/login" className="btn btn-solid btn-full">
            Sign In To Existing Account
          </Link>
          <Link href="/" className="btn btn-ghost btn-full">
            Back To Overview
          </Link>
        </div>
      </section>
    </main>
  )
}
