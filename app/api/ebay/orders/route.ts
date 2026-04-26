import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { EbayNetworkError, EbayReconnectRequiredError, getValidEbayAccessToken } from '@/lib/ebay-auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const credentials = await getValidEbayAccessToken(session.user.id)
    if (!credentials?.accessToken) {
      return apiOk({ connected: false, awaiting: [], recent: [], total: 0 })
    }

    const base = credentials.sandboxMode ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
    const awaitingUrl = new URL(`${base}/sell/fulfillment/v1/order`)
    awaitingUrl.searchParams.set('limit', '50')
    awaitingUrl.searchParams.set('filter', 'orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}')

    const recentUrl = new URL(`${base}/sell/fulfillment/v1/order`)
    recentUrl.searchParams.set('limit', '50')

    const [awaitingRes, recentRes] = await Promise.all([
      fetch(awaitingUrl, {
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Language': 'en-US' },
      }),
      fetch(recentUrl, {
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Language': 'en-US' },
      }),
    ])

    if (awaitingRes.status === 401 || recentRes.status === 401) {
      return apiError('Your eBay session expired. Reconnect your account in Settings.', {
        status: 401,
        code: 'RECONNECT_REQUIRED',
      })
    }

    if (!awaitingRes.ok || !recentRes.ok) {
      const failedResponse = !awaitingRes.ok ? awaitingRes : recentRes
      const detail = await failedResponse.text()
      return apiError(`eBay API request failed with status ${failedResponse.status}.`, {
        status: 502,
        code: 'EBAY_API_ERROR',
        details: detail.slice(0, 400),
      })
    }

    const [awaiting, recent] = await Promise.all([awaitingRes.json(), recentRes.json()])

    return apiOk({
      connected: true,
      awaiting: awaiting.orders || [],
      recent: recent.orders || [],
      total: recent.total || 0,
    })
  } catch (error) {
    if (error instanceof EbayReconnectRequiredError) {
      return apiError(error.message, {
        status: 401,
        code: 'RECONNECT_REQUIRED',
      })
    }

    if (error instanceof EbayNetworkError) {
      return apiError(error.message, {
        status: 503,
        code: 'EBAY_NETWORK_ERROR',
      })
    }

    const message = getErrorText(error, 'Unable to sync eBay orders.')
    if (/invalid refresh token|token refresh failed|expired|revoked|reconnect/i.test(message)) {
      return apiError('Your eBay session expired. Reconnect your account in Settings.', {
        status: 401,
        code: 'RECONNECT_REQUIRED',
        details: message,
      })
    }

    if (/fetch failed/i.test(message)) {
      return apiError('Unable to reach eBay right now. Please try again in a minute or reconnect eBay in Settings.', {
        status: 503,
        code: 'EBAY_NETWORK_ERROR',
      })
    }

    return apiError(message, {
      status: 500,
      code: 'ORDER_SYNC_FAILED',
    })
  }
}
