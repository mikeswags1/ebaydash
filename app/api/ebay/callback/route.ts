import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { EBAY_OAUTH_SCOPES } from '@/lib/ebay-auth'

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
    const credentials = Buffer.from(
      `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`
    ).toString('base64')

    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.EBAY_RUNAME!,
        scope: EBAY_OAUTH_SCOPES.join(' '),
      }),
    })

    const data = await res.json()

    if (!data.access_token) {
      console.error('eBay token exchange failed:', JSON.stringify(data))
      const msg = encodeURIComponent(data.error_description || data.error || 'token_failed')
      return NextResponse.redirect(new URL(`/dashboard?ebay=error&msg=${msg}`, req.url))
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    // Save tokens to DB
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
    const msg = encodeURIComponent(String(e).slice(0, 120))
    console.error('eBay callback error:', e)
    return NextResponse.redirect(new URL(`/dashboard?ebay=error&msg=${msg}`, req.url))
  }
}
