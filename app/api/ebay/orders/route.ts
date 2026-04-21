import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiOk({ connected: false, awaiting: [], recent: [], total: 0 })
  }

  const base = credentials.sandboxMode ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'

  try {
    const [awaitingRes, recentRes] = await Promise.all([
      fetch(`${base}/sell/fulfillment/v1/order?limit=50&ordersFulfillmentStatus=NOT_STARTED`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Language': 'en-US' },
      }),
      fetch(`${base}/sell/fulfillment/v1/order?limit=50`, {
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
    return apiError(getErrorText(error, 'Unable to sync eBay orders.'), {
      status: 500,
      code: 'ORDER_SYNC_FAILED',
    })
  }
}
