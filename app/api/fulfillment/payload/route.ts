import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { getFulfillmentPayloadByToken, normalizeShipTo } from '@/lib/fulfillment'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function rawShipToJson(job: { ship_to: unknown }): unknown {
  const s = job.ship_to
  if (s == null) return {}
  if (typeof s === 'string') {
    try {
      return JSON.parse(s)
    } catch {
      return {}
    }
  }
  return s
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() || ''
  if (!token) return apiError('Missing token.', { status: 400, code: 'MISSING_TOKEN' })

  const job = await getFulfillmentPayloadByToken(token)
  if (!job) {
    return apiError('Token is invalid or expired.', { status: 401, code: 'TOKEN_INVALID' })
  }

  const shipTo = normalizeShipTo(rawShipToJson(job))

  return apiOk(
    {
      orderId: job.order_id,
      legacyItemId: job.legacy_item_id,
      asin: job.asin,
      amazonUrl: job.amazon_url,
      shipTo,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
