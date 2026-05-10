'use client'

import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'stackpilot:get_the_app:dismissed:v1'

function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

function hintForUserAgent(ua: string): { line: string; detail: string } {
  const isIOS = /iPad|iPhone|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)

  if (isIOS) {
    return {
      line: 'iPhone & iPad (Safari)',
      detail: 'Tap the Share button → Add to Home Screen. Launch StackPilot from your home screen icon.',
    }
  }
  if (isAndroid) {
    return {
      line: 'Android (Chrome)',
      detail: 'Tap the menu (⋮) → Install app or Add to Home screen.',
    }
  }
  return {
    line: 'Desktop',
    detail: 'Use the browser install option (e.g. Chrome ⋮ → Save and share → Install page as app) or bookmark this site.',
  }
}

export function GetTheAppBanner({
  variant = 'dashboard',
  compact = false,
}: {
  variant?: 'dashboard' | 'login' | 'marketing'
  /** Light PWA shell — match card styling */
  compact?: boolean
}) {
  const [show, setShow] = useState(false)

  const copy = useMemo(() => hintForUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : ''), [])

  useEffect(() => {
    if (isInstalledPwa()) return
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      /* ignore */
    }
    setShow(true)
  }, [])

  if (!show) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  const mods = [
    'get-app-banner',
    variant === 'login' ? 'get-app-banner--login' : '',
    variant === 'marketing' ? 'get-app-banner--marketing' : '',
    compact ? 'get-app-banner--compact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={mods} role="region" aria-label="Install StackPilot on your device">
      <div className="get-app-banner__main">
        <div className="get-app-banner__kicker">Get our app</div>
        <div className="get-app-banner__title">Add StackPilot to your home screen</div>
        <p className="get-app-banner__lead">
          <strong>{copy.line}:</strong> {copy.detail}
        </p>
      </div>
      <button type="button" className="get-app-banner__dismiss" onClick={dismiss} aria-label="Dismiss install hint">
        Got it
      </button>
    </div>
  )
}
