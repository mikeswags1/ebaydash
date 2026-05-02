import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows } from '@/lib/db'

const MARKETING_BASE = 'https://api.ebay.com/sell/marketing/v1'

// Add all active eBay listings to this campaign
export async function POST(req: NextRequest, { params }: { params: { campaignId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const { campaignId } = params
  const body = await req.json().catch(() => ({})) as { adRate?: string | number }

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect in Settings.', { status: 401, code: 'RECONNECT_REQUIRED' })
  }

  // Load all active listing IDs for this user
  const rows = await queryRows<{ ebay_listing_id: string }>`
    SELECT ebay_listing_id
    FROM listed_asins
    WHERE user_id = ${session.user.id}
      AND ended_at IS NULL
      AND ebay_listing_id IS NOT NULL
    ORDER BY listed_at DESC
    LIMIT 500
  `.catch(() => [])

  if (rows.length === 0) {
    return apiOk({ added: 0, failed: 0, total: 0, message: 'No active listings found to add to this campaign.' })
  }

  const listingIds = rows.map(r => r.ebay_listing_id)
  const adRateParsed = body.adRate ? parseFloat(String(body.adRate)) : undefined

  let added = 0
  let failed = 0
  const BATCH_SIZE = 100

  for (let i = 0; i < listingIds.length; i += BATCH_SIZE) {
    const batch = listingIds.slice(i, i + BATCH_SIZE)
    const reqBody: Record<string, unknown> = { listingIds: batch }
    if (adRateParsed && Number.isFinite(adRateParsed)) {
      reqBody.bidPercentage = adRateParsed.toFixed(1)
    }

    try {
      const res = await fetch(
        `${MARKETING_BASE}/ad_campaign/${campaignId}/ads/create_ads_by_listing_id`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(20000),
        }
      )
      if (res.ok) added += batch.length
      else failed += batch.length
    } catch {
      failed += batch.length
    }
  }

  const message = added > 0
    ? `${added} listing${added !== 1 ? 's' : ''} added to campaign.${failed > 0 ? ` ${failed} failed.` : ''}`
    : `Failed to add listings. ${failed} errors.`

  return apiOk({ added, failed, total: listingIds.length, message })
}
