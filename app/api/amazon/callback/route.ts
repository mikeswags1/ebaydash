import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const spApiOauthCode = searchParams.get('spapi_oauth_code')
  const sellingPartnerId = searchParams.get('selling_partner_id')
  const userId = searchParams.get('state')

  if (!spApiOauthCode || !userId) {
    return NextResponse.redirect(new URL('/dashboard?amazon=error&msg=missing_params', req.url))
  }

  if (isNaN(parseInt(userId))) {
    return NextResponse.redirect(new URL('/dashboard?amazon=error&msg=invalid_session', req.url))
  }

  try {
    const res = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: spApiOauthCode,
        redirect_uri: process.env.AMAZON_REDIRECT_URI!,
        client_id: process.env.AMAZON_CLIENT_ID!,
        client_secret: process.env.AMAZON_CLIENT_SECRET!,
      }),
    })

    const data = await res.json()

    if (!data.access_token) {
      const msg = encodeURIComponent(data.error_description || data.error || 'token_failed')
      return NextResponse.redirect(new URL(`/dashboard?amazon=error&msg=${msg}`, req.url))
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    await sql`
      INSERT INTO amazon_credentials (user_id, selling_partner_id, access_token, refresh_token, token_expires_at, updated_at)
      VALUES (${userId}, ${sellingPartnerId || ''}, ${data.access_token}, ${data.refresh_token || ''}, ${expiresAt.toISOString()}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        selling_partner_id = ${sellingPartnerId || ''},
        access_token = ${data.access_token},
        refresh_token = ${data.refresh_token || ''},
        token_expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
    `

    return NextResponse.redirect(new URL('/dashboard?amazon=connected', req.url))
  } catch (e) {
    const msg = encodeURIComponent(String(e).slice(0, 120))
    console.error('Amazon callback error:', e)
    return NextResponse.redirect(new URL(`/dashboard?amazon=error&msg=${msg}`, req.url))
  }
}
