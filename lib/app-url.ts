import type { NextRequest } from 'next/server'

/** Canonical public URL for redirects (Stripe success/cancel, portal return). */
export function getAppOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return 'http://localhost:3000'
}
