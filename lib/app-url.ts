import type { NextRequest } from 'next/server'

/** Canonical public URL for redirects (Stripe success/cancel, portal return). */
export function getAppOrigin(req: NextRequest): string {
  const fromEnv = normalizeOrigin(process.env.NEXTAUTH_URL)
  if (fromEnv) return fromEnv

  const fromRequestUrl = normalizeOrigin(req.nextUrl.origin)
  if (fromRequestUrl) return fromRequestUrl

  const fromOriginHeader = normalizeOrigin(req.headers.get('origin'))
  if (fromOriginHeader) return fromOriginHeader

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const fromForwardedHost = normalizeOrigin(host ? `${proto}://${host}` : null)
  if (fromForwardedHost) return fromForwardedHost

  const fromVercelUrl = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL)
  if (fromVercelUrl) return fromVercelUrl

  if (process.env.NODE_ENV === 'production') return 'https://stackpilot-app.vercel.app'
  return 'http://localhost:3000'
}

function normalizeOrigin(value?: string | null): string {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw) return ''

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const url = new URL(withProtocol)
    if (!url.hostname) return ''
    return url.origin
  } catch {
    return ''
  }
}
