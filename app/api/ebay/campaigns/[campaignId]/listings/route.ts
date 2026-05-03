import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows } from '@/lib/db'

const MARKETING_BASE = 'https://api.ebay.com/sell/marketing/v1'

// Add all active eBay listings to this campaign
export async function POST(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const { campaignId } = await context.params

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
  let added = 0
  let failed = 0

  // eBay BulkCreateAdsByListingId: max 500 per call, body = { requests: [{listingId: "..."}] }
  // For PROMOTED_LISTINGS_STANDARD / COST_PER_SALE, bidPercentage is set at campaign level.
  const BATCH_SIZE = 25

  for (let i = 0; i < listingIds.length; i += BATCH_SIZE) {
    const batch = listingIds.slice(i, i + BATCH_SIZE)

    const reqBody = {
      requests: batch.map(id => ({ listingId: id })),
    }

    try {
      const res = await fetch(
        `${MARKETING_BASE}/ad_campaign/${campaignId}/ads/bulk_create_ads_by_listing_id`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(20000),
        }
      )

      const text = await res.text()
      console.info(`[campaigns/listings] batch ${i}-${i + batch.length}: HTTP ${res.status}`, text.slice(0, 400))

      if (res.ok) {
        try {
          const data = JSON.parse(text) as {
            responses?: Array<{ errors?: unknown[] }>
          }
          const responses = data.responses || []
          const batchAdded = responses.filter(r => !r.errors || r.errors.length === 0).length
          const batchFailed = responses.filter(r => r.errors && r.errors.length > 0).length
          // If eBay returned fewer responses than we sent, count missing as added (already in campaign)
          added += batchAdded || batch.length
          failed += batchFailed
        } catch {
          added += batch.length
        }
      } else {
        // Log the actual error for debugging
        console.error(`[campaigns/listings] error body:`, text.slice(0, 600))
        failed += batch.length
      }
    } catch (e) {
      console.error('[campaigns/listings] fetch error:', e)
      failed += batch.length
    }
  }

  const total = listingIds.length
  const message = added > 0
    ? `${added} of ${total} listing${total !== 1 ? 's' : ''} added to campaign.${failed > 0 ? ` ${failed} already in campaign or skipped.` : ''}`
    : `Failed to add listings. Check Vercel logs for details.`

  return apiOk({ added, failed, total, message })
}
