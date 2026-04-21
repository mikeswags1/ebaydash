import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getStoredEbayCredentials, refreshEbayAccessToken } from '@/lib/ebay-auth'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const credentials = await getStoredEbayCredentials(session.user.id)
    const refreshToken = credentials?.refresh_token ? String(credentials.refresh_token) : ''

    if (!refreshToken) {
      return apiError('No eBay refresh token is stored for this account. Reconnect eBay to continue.', {
        status: 401,
        code: 'RECONNECT_REQUIRED',
      })
    }

    const refreshed = await refreshEbayAccessToken(session.user.id, refreshToken)
    return apiOk({ success: true, expiresAt: refreshed.expiresAt })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to refresh the eBay session.'), {
      status: 500,
      code: 'EBAY_REFRESH_FAILED',
    })
  }
}
