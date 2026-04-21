import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { queryRows } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const rows = await queryRows<{ asin: string; ebay_listing_id: string; title: string }>`
      SELECT asin, ebay_listing_id, title
      FROM listed_asins
      WHERE user_id = ${session.user.id}
        AND ebay_listing_id IS NOT NULL
    `

    const map: Record<string, { asin: string; title: string }> = {}
    for (const row of rows) {
      if (row.ebay_listing_id) {
        map[String(row.ebay_listing_id)] = {
          asin: String(row.asin),
          title: String(row.title || ''),
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
