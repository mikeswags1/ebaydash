import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { queryRows } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const rows = await queryRows<{ asin: string; ebay_listing_id: string; title: string; amazon_snapshot?: unknown; amazon_image_url?: string | null }>`
      SELECT asin, ebay_listing_id, title, amazon_snapshot, amazon_image_url
      FROM listed_asins
      WHERE user_id = ${session.user.id}
        AND ebay_listing_id IS NOT NULL
    `

    const map: Record<string, { asin: string; title: string; amazonUrl?: string; imageUrl?: string; confidence?: 'manual' }> = {}
    for (const row of rows) {
      if (row.ebay_listing_id) {
        const snapshot =
          row.amazon_snapshot && typeof row.amazon_snapshot === 'object'
            ? (row.amazon_snapshot as Record<string, unknown>)
            : null
        map[String(row.ebay_listing_id)] = {
          asin: String(row.asin),
          title: String(snapshot?.title || row.title || ''),
          amazonUrl: typeof snapshot?.amazonUrl === 'string' ? snapshot.amazonUrl : `https://www.amazon.com/dp/${row.asin}`,
          imageUrl:
            typeof snapshot?.imageUrl === 'string'
              ? snapshot.imageUrl
              : row.amazon_image_url || undefined,
          confidence: typeof snapshot?.recoveredFrom === 'string' && snapshot.recoveredFrom === 'manual_confirmed' ? 'manual' : undefined,
        }
      }
    }

    return apiOk({ map })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load the order-to-ASIN map.'), {
      status: 500,
      code: 'ORDER_ASIN_MAP_LOAD_FAILED',
    })
  }
}
