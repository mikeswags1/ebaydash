import { queryRows, sql } from '@/lib/db'

export const EBAY_OAUTH_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
]

type StoredEbayCredentials = {
  oauth_token?: string
  refresh_token?: string
  token_expires_at?: string
  sandbox_mode?: boolean
}

export async function getStoredEbayCredentials(userId: string) {
  const rows = await queryRows<StoredEbayCredentials>`
    SELECT oauth_token, refresh_token, token_expires_at, sandbox_mode
    FROM ebay_credentials
    WHERE user_id = ${userId}
  `

  return rows[0] || null
}

export function isEbayTokenExpired(tokenExpiresAt?: string, bufferMs = 5 * 60 * 1000) {
  if (!tokenExpiresAt) return true
  return new Date(tokenExpiresAt) < new Date(Date.now() + bufferMs)
}

export async function refreshEbayAccessToken(userId: string, refreshToken: string) {
  const appId = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID

  if (!appId || !certId) {
    throw new Error('eBay app credentials are not configured')
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString('base64')
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: EBAY_OAUTH_SCOPES.join(' '),
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || `eBay token refresh failed (${response.status})`)
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  await sql`
    UPDATE ebay_credentials
    SET oauth_token = ${data.access_token}, token_expires_at = ${expiresAt}, updated_at = NOW()
    WHERE user_id = ${userId}
  `

  return {
    accessToken: data.access_token as string,
    expiresAt,
  }
}

export async function getValidEbayAccessToken(userId: string) {
  const credentials = await getStoredEbayCredentials(userId)
  if (!credentials) return null

  const oauthToken = credentials.oauth_token ? String(credentials.oauth_token) : ''
  const refreshToken = credentials.refresh_token ? String(credentials.refresh_token) : ''

  if (oauthToken && !isEbayTokenExpired(credentials.token_expires_at)) {
    return {
      accessToken: oauthToken,
      sandboxMode: Boolean(credentials.sandbox_mode),
      refreshed: false,
    }
  }

  if (!refreshToken) return null

  const refreshed = await refreshEbayAccessToken(userId, refreshToken)
  return {
    accessToken: refreshed.accessToken,
    sandboxMode: Boolean(credentials.sandbox_mode),
    refreshed: true,
    expiresAt: refreshed.expiresAt,
  }
}
