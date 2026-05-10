'use client'

import Link from 'next/link'
import { useLayoutEffect, useMemo, useState } from 'react'

/** Bump version when copy changes so QA/users see the updated banner after dismiss. */
const STORAGE_KEY = 'stackpilot:get_the_app:dismissed:v3'

function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    /* ignore */
  }
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

export type GetTheAppBannerProps = {
  variant?: 'dashboard' | 'login' | 'marketing'
  /** Light PWA shell — match card styling */
  compact?: boolean
  /** Narrow left sidebar on desktop dashboard */
  sidebar?: boolean
  /** Full-width strip under desktop top bar (below tab title, above free trial) */
  topRail?: boolean
}

export function GetTheAppBannerInner({
  variant = 'dashboard',
  compact = false,
  sidebar = false,
  topRail = false,
}: GetTheAppBannerProps) {
  /** null until mounted — avoids flashing full banner when already dismissed */
  const [phase, setPhase] = useState<'full' | 'mini' | 'gone' | null>(null)

  const copy = useMemo(() => hintForUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : ''), [])

  const dashboardSurface = topRail || compact || sidebar

  useLayoutEffect(() => {
    if (isInstalledPwa()) {
      setPhase('gone')
      return
    }
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('installHint') === '1') {
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
        setPhase('full')
        return
      }
    } catch {
      /* ignore */
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        if (variant === 'marketing' || variant === 'login') {
          setPhase('gone')
        } else if (dashboardSurface) {
          setPhase('mini')
        } else {
          setPhase('gone')
        }
        return
      }
    } catch {
      /* ignore */
    }
    setPhase('full')
  }, [variant, dashboardSurface])

  if (phase === null || phase === 'gone') return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    if (variant === 'marketing' || variant === 'login') {
      setPhase('gone')
    } else if (dashboardSurface) {
      setPhase('mini')
    } else {
      setPhase('gone')
    }
  }

  const mods = [
    'get-app-banner',
    variant === 'login' ? 'get-app-banner--login' : '',
    variant === 'marketing' ? 'get-app-banner--marketing' : '',
    compact ? 'get-app-banner--compact' : '',
    sidebar ? 'get-app-banner--sidebar' : '',
    topRail ? 'get-app-banner--toprail' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (phase === 'mini') {
    const miniMods = [
      'get-app-banner',
      'get-app-banner--mini-strip',
      variant === 'marketing' ? 'get-app-banner--marketing' : '',
      compact ? 'get-app-banner--compact' : '',
      sidebar ? 'get-app-banner--sidebar' : '',
      topRail ? 'get-app-banner--toprail' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={miniMods} role="region" aria-label="Install StackPilot on your device">
        <p className="get-app-banner__mini-lead">
          <strong>Get the app:</strong> Add StackPilot to your home screen for quicker access.
        </p>
        <Link href="/guide" className="get-app-banner__mini-guide">
          How to install
        </Link>
      </div>
    )
  }

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
