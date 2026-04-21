import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows } from '@/lib/db'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'

const DEFAULT_EBAY_FEE_RATE = 0.1325

type EbayOrder = {
  orderId: string
  creationDate: string
  pricingSummary?: { total?: { value?: string } }
  lineItems?: Array<{
    title?: string
    quantity?: number
    lineItemCost?: { value?: string }
    legacyItemId?: string
  }>
}

type ListedAsinRow = {
  asin?: string
  title?: string
  ebay_listing_id?: string
  amazon_price?: string | number | null
  ebay_price?: string | number | null
  ebay_fee_rate?: string | number | null
}

function parseMoney(value: unknown) {
  const amount = parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pack|set|piece|pcs|count|for|with|and|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiOk({
      connected: false,
      summary: {
        grossRevenue: 0,
        trackedRevenue: 0,
        amazonCost: 0,
        ebayFees: 0,
        profit: 0,
        roi: 0,
        margin: 0,
        soldItems: 0,
        trackedItems: 0,
        missingCostItems: 0,
      },
      items: [],
    })
  }

  try {
    await ensureListedAsinsFinancialColumns()

    const base = credentials.sandboxMode ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
    const response = await fetch(`${base}/sell/fulfillment/v1/order?limit=100`, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Language': 'en-US',
      },
    })

    if (response.status === 401) {
      return apiError('Your eBay session expired. Reconnect your account in Settings.', {
        status: 401,
        code: 'RECONNECT_REQUIRED',
      })
    }

    if (!response.ok) {
      const detail = await response.text()
      return apiError(`Unable to load financial order data from eBay (${response.status}).`, {
        status: 502,
        code: 'EBAY_FINANCIALS_FAILED',
        details: detail.slice(0, 400),
      })
    }

    const orderPayload = (await response.json()) as { orders?: EbayOrder[] }
    const orders = Array.isArray(orderPayload.orders) ? orderPayload.orders : []

    const listingRows = await queryRows<ListedAsinRow>`
      SELECT asin, title, ebay_listing_id, amazon_price, ebay_price, ebay_fee_rate
      FROM listed_asins
      WHERE user_id = ${session.user.id}
        AND ebay_listing_id IS NOT NULL
    `

    const listingById = new Map(
      listingRows
        .filter((row) => row.ebay_listing_id)
        .map((row) => [String(row.ebay_listing_id), row] as const)
    )
    const listingsByTitle = new Map<string, ListedAsinRow[]>()
    for (const row of listingRows) {
      const normalized = normalizeTitle(String(row.title || ''))
      if (!normalized) continue
      const current = listingsByTitle.get(normalized) || []
      current.push(row)
      listingsByTitle.set(normalized, current)
    }

    const items = orders.flatMap((order) =>
      (order.lineItems || []).map((lineItem, index) => {
        const listingId = lineItem.legacyItemId ? String(lineItem.legacyItemId) : ''
        const normalizedTitle = normalizeTitle(String(lineItem.title || ''))
        const titleMatches = normalizedTitle ? listingsByTitle.get(normalizedTitle) || [] : []
        const listing = listingId ? listingById.get(listingId) : titleMatches.length === 1 ? titleMatches[0] : undefined
        const quantity = Math.max(1, Number(lineItem.quantity || 1))
        const fallbackRevenue = (order.lineItems?.length || 0) <= 1 ? parseMoney(order.pricingSummary?.total?.value) : 0
        const revenue = parseMoney(lineItem.lineItemCost?.value) || fallbackRevenue
        const amazonUnitCost = listing?.amazon_price === null || listing?.amazon_price === undefined ? null : parseMoney(listing.amazon_price)
        const amazonCost = amazonUnitCost === null ? null : amazonUnitCost * quantity
        const feeRate = listing?.ebay_fee_rate === null || listing?.ebay_fee_rate === undefined ? DEFAULT_EBAY_FEE_RATE : Number(listing.ebay_fee_rate)
        const ebayFees = revenue * feeRate
        const profit = amazonCost === null ? null : revenue - amazonCost - ebayFees
        const roi = amazonCost && amazonCost > 0 && profit !== null ? (profit / amazonCost) * 100 : null
        const margin = revenue > 0 && profit !== null ? (profit / revenue) * 100 : null

        return {
          id: `${order.orderId}:${listingId || index}`,
          orderId: order.orderId,
          listingId: listingId || null,
          asin: listing?.asin ? String(listing.asin) : null,
          title: lineItem.title || listing?.title || order.orderId,
          soldAt: order.creationDate,
          quantity,
          ebayRevenue: revenue,
          amazonUnitCost,
          amazonCost,
          ebayFeeRate: feeRate,
          ebayFees,
          profit,
          roi,
          margin,
          hasTrackedCost: amazonCost !== null,
        }
      })
    )

    const grossRevenue = items.reduce((sum, item) => sum + item.ebayRevenue, 0)
    const trackedItems = items.filter((item) => item.hasTrackedCost)
    const trackedRevenue = trackedItems.reduce((sum, item) => sum + item.ebayRevenue, 0)
    const amazonCost = trackedItems.reduce((sum, item) => sum + (item.amazonCost || 0), 0)
    const ebayFees = trackedItems.reduce((sum, item) => sum + item.ebayFees, 0)
    const profit = trackedItems.reduce((sum, item) => sum + (item.profit || 0), 0)
    const roi = amazonCost > 0 ? (profit / amazonCost) * 100 : 0
    const margin = trackedRevenue > 0 ? (profit / trackedRevenue) * 100 : 0

    return apiOk({
      connected: true,
      summary: {
        grossRevenue,
        trackedRevenue,
        amazonCost,
        ebayFees,
        profit,
        roi,
        margin,
        soldItems: items.length,
        trackedItems: trackedItems.length,
        missingCostItems: items.length - trackedItems.length,
      },
      items,
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load financial data.'), {
      status: 500,
      code: 'FINANCIALS_LOAD_FAILED',
    })
  }
}
