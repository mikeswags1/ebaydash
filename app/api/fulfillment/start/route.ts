import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { createFulfillmentJob, normalizeShipTo } from '@/lib/fulfillment'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const body = (await req.json().catch(() => null)) as any
    const orderId = String(body?.orderId || '').trim()
    const legacyItemId = body?.legacyItemId ? String(body.legacyItemId).trim() : null
    const asin = body?.asin ? String(body.asin).trim() : null
    const amazonUrl = body?.amazonUrl ? String(body.amazonUrl).trim() : null
    const shipTo = normalizeShipTo(body?.shipTo)

    if (!orderId) return apiError('Missing orderId.', { status: 400, code: 'MISSING_ORDER_ID' })
    if (!amazonUrl) return apiError('Missing amazonUrl.', { status: 400, code: 'MISSING_AMAZON_URL' })

    const job = await createFulfillmentJob({
      userId: session.user.id,
      orderId,
      legacyItemId,
      asin,
      amazonUrl,
      shipTo,
      ttlMinutes: 15,
    })

    const fulfillUrl = `${amazonUrl}${amazonUrl.includes('#') ? '' : '#'}fulfillToken=${job.token}`

    return apiOk({
      orderId,
      legacyItemId,
      amazonUrl: job.amazonUrl,
      fulfillToken: job.token,
      fulfillUrl,
      jobId: job.jobId,
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Failed to start fulfillment.'), { status: 500, code: 'FULFILLMENT_START_FAILED' })
  }
}

