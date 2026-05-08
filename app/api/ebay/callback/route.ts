import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { EBAY_OAUTH_SCOPES } from '@/lib/ebay-auth'
import { ensureAutoListingTables } from '@/lib/auto-listing/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/dashboard?ebay=error', req.url))
  }

  // Guard: userId must be a valid integer
  if (!userId || isNaN(parseInt(userId))) {
    console.error('eBay callback: invalid userId in state param:', userId)
    return NextResponse.redirect(new URL('/dashboard?ebay=error&msg=invalid_session', req.url))
  }

  try {
    // Exchange code for access + refresh tokens
    const appId = String(process.env.EBAY_APP_ID || '').trim()
    const certId = String(process.env.EBAY_CERT_ID || '').trim()
    const redirectUri = String(process.env.EBAY_RUNAME || '').trim()
    const credentials = Buffer.from(
      `${appId}:${certId}`
    ).toString('base64')

    let res: Response
    try {
      res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          scope: EBAY_OAUTH_SCOPES.join(' '),
        }),
      })
    } catch (error) {
      console.error('eBay token exchange network error:', error)
      return NextResponse.redirect(new URL('/dashboard?ebay=error&msg=Unable%20to%20reach%20eBay%20during%20connection.%20Please%20try%20again.', req.url))
    }

    const data = await res.json().catch(() => null)

    if (!data.access_token) {
      console.error('eBay token exchange failed:', JSON.stringify(data))
      const msg = encodeURIComponent(data.error_description || data.error || 'token_failed')
      return NextResponse.redirect(new URL(`/dashboard?ebay=error&msg=${msg}`, req.url))
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    // Save tokens to DB
    await ensureAutoListingTables()
    // New multi-account table (default label). Keep legacy table in sync for backwards compatibility.
    await sql`
      INSERT INTO ebay_accounts (user_id, label, oauth_token, refresh_token, token_expires_at, sandbox_mode, active, updated_at)
      VALUES (${userId}, 'Default', ${data.access_token}, ${data.refresh_token || ''}, ${expiresAt.toISOString()}, false, TRUE, NOW())
      ON CONFLICT (user_id, label) DO UPDATE SET
        oauth_token = ${data.access_token},
        refresh_token = ${data.refresh_token || ''},
        token_expires_at = ${expiresAt.toISOString()},
        sandbox_mode = FALSE,
        active = TRUE,
        updated_at = NOW()
    `.catch(() => {})
    await sql`
      INSERT INTO ebay_credentials (user_id, oauth_token, refresh_token, token_expires_at, sandbox_mode, updated_at)
      VALUES (${userId}, ${data.access_token}, ${data.refresh_token || ''}, ${expiresAt.toISOString()}, false, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        oauth_token = ${data.access_token},
        refresh_token = ${data.refresh_token || ''},
        token_expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
    `

    return NextResponse.redirect(new URL('/dashboard?ebay=connected', req.url))
  } catch (e) {
    const raw = String(e)
    const safeMessage = /fetch failed/i.test(raw)
      ? 'Unable to reach eBay during connection. Please try again.'
      : raw.slice(0, 120)
    const msg = encodeURIComponent(safeMessage)
    console.error('eBay callback error:', e)
    return NextResponse.redirect(new URL(`/dashboard?ebay=error&msg=${msg}`, req.url))
  }
}
