'use client'

import { useEffect, useState } from 'react'

const APP_URL = 'https://stackpilot-app.vercel.app'
const DISMISS_KEY = 'stackpilot:get_app_banner:dismissed:v1'

export function GetAppBanner({ variant = 'home' }: { variant?: 'home' | 'dashboard' }) {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (variant !== 'dashboard') return
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [variant])

  if (variant === 'dashboard' && dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section id={variant === 'home' ? 'get-app' : undefined} className={`get-app-banner get-app-banner--${variant}`} aria-label="Get the StackPilot app">
      <div className="get-app-banner__copy">
        <span className="get-app-banner__eyebrow">Get the app</span>
        <h2>Put StackPilot on your phone</h2>
        <p>
          Open StackPilot in your phone browser, then add it to your Home Screen. It launches like an app and keeps the dashboard one tap away.
        </p>
      </div>

      <div className="get-app-banner__steps" aria-label="Install steps">
        <div className="get-app-banner__step">
          <strong>iPhone</strong>
          <span>Open Safari, visit stackpilot-app.vercel.app, tap Share, then Add to Home Screen.</span>
        </div>
        <div className="get-app-banner__step">
          <strong>Android</strong>
          <span>Open Chrome, visit stackpilot-app.vercel.app, tap the menu, then Add to Home screen or Install app.</span>
        </div>
      </div>

      <div className="get-app-banner__actions">
        <a className="btn btn-solid btn-sm" href={APP_URL}>
          Open App Link
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy Link'}
        </button>
        {variant === 'dashboard' ? (
          <button type="button" className="get-app-banner__dismiss" onClick={dismiss} aria-label="Dismiss get app banner">
            Close
          </button>
        ) : null}
      </div>
    </section>
  )
}
