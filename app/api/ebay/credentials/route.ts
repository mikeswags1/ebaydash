import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getStoredEbayCredentials, isEbayTokenExpired } from '@/lib/ebay-auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const credentials = await getStoredEbayCredentials(session.user.id)
    const hasToken = Boolean(credentials?.oauth_token || credentials?.refresh_token)

    return apiOk({
      credentials: credentials
        ? {
            sandbox_mode: Boolean(credentials.sandbox_mode),
            has_token: hasToken,
            has_refresh_token: Boolean(credentials.refresh_token),
            token_expired: isEbayTokenExpired(credentials.token_expires_at),
          }
        : null,
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load eBay credentials.'), {
      status: 500,
      code: 'EBAY_CREDENTIALS_LOAD_FAILED',
    })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const { app_id, cert_id, dev_id, oauth_token, sandbox_mode } = await req.json()

    await sql`
      INSERT INTO ebay_credentials (user_id, app_id, cert_id, dev_id, oauth_token, sandbox_mode, updated_at)
      VALUES (${session.user.id}, ${app_id || ''}, ${cert_id || ''}, ${dev_id || ''}, ${oauth_token || ''}, ${sandbox_mode ?? false}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        app_id = ${app_id || ''},
        cert_id = ${cert_id || ''},
        dev_id = ${dev_id || ''},
        oauth_token = ${oauth_token || ''},
        sandbox_mode = ${sandbox_mode ?? false},
        updated_at = NOW()
    `

    return apiOk({ success: true })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to save eBay credentials.'), {
      status: 500,
      code: 'EBAY_CREDENTIALS_SAVE_FAILED',
    })
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    await sql`DELETE FROM ebay_credentials WHERE user_id = ${session.user.id}`
    return apiOk({ success: true })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to disconnect eBay.'), {
      status: 500,
      code: 'EBAY_DISCONNECT_FAILED',
    })
  }
}
