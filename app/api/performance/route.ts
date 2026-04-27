import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { EbayNetworkError, EbayReconnectRequiredError, getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows, sql } from '@/lib/db'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'

const DEFAULT_EBAY_FEE_RATE = 0.1325
const PERFORMANCE_DAYS = 90

type ListingRow = {
  asin?: string | null
  title?: string | null
  ebay_listing_id?: string | null
  amazon_price?: string | number | null
  ebay_price?: string | number | null
  ebay_fee_rate?: string | number | null
  niche?: string | null
  category_id?: string | null
  category_name?: string | null
  listed_at?: string | null
  ended_at?: string | null
}

type EbayOrder = {
  orderId: string
  creationDate: string
  orderPaymentStatus?: string
  cancelStatus?: { cancelState?: string }
  paymentSummary?: {
    refunds?: Array<{ refundStatus?: string; amount?: { value?: string } }>
  }
  pricingSummary?: { total?: { value?: string } }
  lineItems?: Array<{
    lineItemId?: string
    legacyItemId?: string
    title?: string
    quantity?: number
    lineItemCost?: { value?: string }
    refunds?: Array<{ refundStatus?: string; amount?: { value?: string } }>
  }>
}

type TrafficMetric = {
  views: number
  impressions: number
  transactions: number
  conversionRate: number | null
}

type ActiveListingMetric = {
  listingId: string
  title: string
  watchers: number
  views: number
  quantity: number
  quantitySold: number
  price: number
  categoryId?: string
  categoryName?: string
}

const NICHE_INFERENCE_RULES: Array<{ niche: string; terms: string[] }> = [
  { niche: 'Phone Accessories', terms: ['phone case', 'screen protector', 'wireless charger', 'phone mount', 'iphone', 'samsung galaxy'] },
  { niche: 'Computer Parts', terms: ['usb hub', 'laptop stand', 'keyboard', 'mouse', 'computer', 'poster tube', 'document tube'] },
  { niche: 'Audio & Headphones', terms: ['headphone', 'earphone', 'earbud', 'speaker', 'audio', 'microphone'] },
  { niche: 'Smart Home Devices', terms: ['smart plug', 'security camera', 'smart bulb', 'motion sensor', 'alexa'] },
  { niche: 'Gaming Gear', terms: ['gaming', 'controller', 'playstation', 'xbox', 'nintendo'] },
  { niche: 'Kitchen Gadgets', terms: ['kitchen', 'utensil', 'air fryer', 'slicer', 'can opener', 'tablecloth'] },
  { niche: 'Home Decor', terms: ['decor', 'cushion', 'pillow', 'vase', 'wall art', 'plant riser', 'pot feet', 'tablecloth'] },
  { niche: 'Furniture & Lighting', terms: ['lamp', 'bench cushion', 'chair', 'desk', 'furniture', 'lighting'] },
  { niche: 'Cleaning Supplies', terms: ['cleaning', 'mop', 'squeegee', 'microfiber', 'paper towel', 'towel roll'] },
  { niche: 'Storage & Organization', terms: ['storage', 'organizer', 'divider', 'bin', 'vacuum bag'] },
  { niche: 'Camping & Hiking', terms: ['camping', 'hiking', 'lantern', 'flashlight', 'fire starter'] },
  { niche: 'Garden & Tools', terms: ['garden', 'pruning', 'plant', 'kneeling pad', 'glove', 'tool'] },
  { niche: 'Sporting Goods', terms: ['sport', 'nba', 't shirt', 'knee brace', 'pontoon', 'boat', 'dock', 'fender', 'workout'] },
  { niche: 'Fishing & Hunting', terms: ['fishing', 'hunting', 'lure', 'tackle', 'trail camera'] },
  { niche: 'Cycling', terms: ['bike', 'bicycle', 'cycling'] },
  { niche: 'Fitness Equipment', terms: ['fitness', 'resistance band', 'ab roller', 'yoga', 'foam roller', 'knee brace'] },
  { niche: 'Personal Care', terms: ['personal care', 'facial', 'hair', 'nail', 'cuticle'] },
  { niche: 'Supplements & Vitamins', terms: ['vitamin', 'supplement', 'magnesium', 'collagen', 'gummy'] },
  { niche: 'Medical Supplies', terms: ['medical', 'thermometer', 'blood pressure', 'pill organizer', 'brace'] },
  { niche: 'Car Accessories', terms: ['car', 'auto', 'vehicle', 'seat cover', 'dash cam'] },
  { niche: 'Pet Supplies', terms: ['dog', 'cat', 'pet', 'leash', 'harness', 'chew', 'deshedding'] },
  { niche: 'Baby & Kids', terms: ['baby', 'toddler', 'diaper', 'kids'] },
  { niche: 'Toys & Games', terms: ['toy', 'game', 'magnetic tiles', 'fidget'] },
  { niche: 'Clothing & Accessories', terms: ['shirt', 't shirt', 'hat', 'socks', 'wallet', 'patch', 'applique', 'clothing'] },
  { niche: 'Jewelry & Watches', terms: ['jewelry', 'bracelet', 'necklace', 'earring', 'watch band'] },
  { niche: 'Office Supplies', terms: ['office', 'label maker', 'wrist rest', 'desk organizer', 'poster tube', 'mailing tube'] },
  { niche: 'Industrial Equipment', terms: ['industrial', 'safety glasses', 'work gloves', 'respirator'] },
  { niche: 'Safety Gear', terms: ['safety', 'first aid', 'hard hat', 'fire extinguisher', 'reflective'] },
  { niche: 'Janitorial & Cleaning', terms: ['janitorial', 'trash bags', 'paper towels', 'hand soap', 'commercial cleaning'] },
  { niche: 'Packaging Materials', terms: ['shipping', 'mailer', 'bubble mailer', 'box', 'packing tape', 'poly mailer'] },
  { niche: 'Trading Cards', terms: ['card sleeve', 'card storage', 'trading card', 'binder'] },
  { niche: 'Comics & Manga', terms: ['comic', 'manga', 'anime'] },
  { niche: 'Sports Memorabilia', terms: ['memorabilia', 'jersey', 'autograph', 'display case'] },
]

function parseMoney(value: unknown) {
  const amount = parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function inferNicheFromText(...values: Array<string | null | undefined>) {
  const text = normalizeTitle(values.filter(Boolean).join(' '))
  if (!text) return null

  let best: { niche: string; score: number } | null = null
  for (const rule of NICHE_INFERENCE_RULES) {
    let score = 0
    for (const term of rule.terms) {
      const normalizedTerm = normalizeTitle(term)
      if (!normalizedTerm) continue
      if (text.includes(normalizedTerm)) {
        score += normalizedTerm.includes(' ') ? 2 : 1
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { niche: rule.niche, score }
    }
  }

  return best?.niche || null
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

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match?.[1] ? decodeXml(match[1].trim()) : ''
}

function isRefundedOrder(order: EbayOrder) {
  const orderRefunds = order.paymentSummary?.refunds || []
  const lineRefunds = (order.lineItems || []).flatMap((lineItem) => lineItem.refunds || [])
  const statuses = [
    order.orderPaymentStatus,
    ...orderRefunds.map((refund) => refund.refundStatus),
    ...lineRefunds.map((refund) => refund.refundStatus),
  ].map((status) => String(status || '').toUpperCase())

  const refundedAmount = [...orderRefunds, ...lineRefunds].reduce((sum, refund) => sum + parseMoney(refund.amount?.value), 0)
  return statuses.includes('FULLY_REFUNDED') || statuses.includes('PARTIALLY_REFUNDED') || refundedAmount > 0
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function fetchOrders(base: string, accessToken: string) {
  const orders: EbayOrder[] = []
  const limit = 100
  let offset = 0
  let total: number | undefined

  while (offset < 1000) {
    const url = new URL(`${base}/sell/fulfillment/v1/order`)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Language': 'en-US' },
      signal: AbortSignal.timeout(12000),
    })

    if (response.status === 401) throw new EbayReconnectRequiredError()
    if (!response.ok) throw new Error(`eBay orders request failed (${response.status}).`)

    const payload = await response.json()
    const pageOrders = Array.isArray(payload.orders) ? payload.orders : []
    orders.push(...pageOrders)
    total = typeof payload.total === 'number' ? payload.total : total
    if (pageOrders.length < limit || (typeof total === 'number' && orders.length >= total)) break
    offset += limit
  }

  return orders
}

async function fetchActiveListingMetrics(base: string, accessToken: string) {
  const appId = process.env.EBAY_APP_ID || ''
  if (!appId) return { listings: new Map<string, ActiveListingMetric>(), available: false, error: 'Missing eBay App ID.' }

  const listings = new Map<string, ActiveListingMetric>()

  for (let page = 1; page <= 4; page += 1) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${escapeXml(accessToken)}</eBayAuthToken></RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeWatchCount>true</IncludeWatchCount>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`

    const response = await fetch(`${base.replace('/sell', '')}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-APP-NAME': appId,
        'Content-Type': 'text/xml',
      },
      body: xml,
      signal: AbortSignal.timeout(15000),
    }).catch(() => null)

    if (!response) return { listings, available: listings.size > 0, error: 'Unable to load active listing signals.' }
    const text = await response.text()
    if (!response.ok || /<Ack>Failure<\/Ack>/i.test(text)) {
      return { listings, available: listings.size > 0, error: tag(text, 'LongMessage') || `Active listing request failed (${response.status}).` }
    }

    const itemBlocks = [...text.matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map((match) => match[1])
    for (const block of itemBlocks) {
      const listingId = tag(block, 'ItemID')
      if (!listingId) continue
      listings.set(listingId, {
        listingId,
        title: tag(block, 'Title'),
        watchers: Number(tag(block, 'WatchCount')) || 0,
        views: Number(tag(block, 'HitCount')) || 0,
        quantity: Number(tag(block, 'Quantity')) || 0,
        quantitySold: Number(tag(block, 'QuantitySold')) || 0,
        price: parseMoney(tag(block, 'CurrentPrice') || tag(block, 'StartPrice')),
        categoryId: tag(block, 'CategoryID'),
        categoryName: tag(block, 'CategoryName'),
      })
    }

    if (itemBlocks.length < 200) break
  }

  return { listings, available: true, error: null as string | null }
}

async function fetchTrafficMetrics(base: string, accessToken: string, listingIds: string[]) {
  const metrics = new Map<string, TrafficMetric>()
  if (listingIds.length === 0) return { metrics, available: false, error: null as string | null }

  const end = new Date()
  const start = new Date(Date.now() - (PERFORMANCE_DAYS - 1) * 24 * 60 * 60 * 1000)
  const metricKeys = ['LISTING_VIEWS_TOTAL', 'LISTING_IMPRESSION_TOTAL', 'SALES_CONVERSION_RATE', 'TRANSACTION']
  const chunks: string[][] = []
  for (let index = 0; index < listingIds.length; index += 200) chunks.push(listingIds.slice(index, index + 200))

  for (const chunk of chunks) {
    const url = new URL(`${base}/sell/analytics/v1/traffic_report`)
    url.searchParams.set('dimension', 'LISTING')
    url.searchParams.set('metric', metricKeys.join(','))
    url.searchParams.set('filter', `marketplace_ids:{EBAY_US},date_range:[${getDateKey(start)}..${getDateKey(end)}],listing_ids:{${chunk.join('|')}}`)
    url.searchParams.set('sort', '-TRANSACTION')

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Language': 'en-US' },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null)

    if (!response) return { metrics, available: metrics.size > 0, error: 'Unable to load eBay traffic metrics.' }
    if (response.status === 401) throw new EbayReconnectRequiredError()
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const missingScope = response.status === 403 || /scope|access|forbidden/i.test(detail)
      return {
        metrics,
        available: metrics.size > 0,
        error: missingScope
          ? 'Reconnect eBay to grant analytics access for views, impressions, and conversion data.'
          : 'eBay traffic metrics are temporarily unavailable, so Performance is using sales, profit, and watcher signals for now.',
      }
    }

    const payload = await response.json()
    const headerMetrics = (payload?.header?.metrics || []).map((metric: { key?: string }) => String(metric.key || '').toUpperCase())
    const records = Array.isArray(payload?.records) ? payload.records : []

    for (const record of records) {
      const listingId = String(record?.dimensionValues?.[0]?.value || '')
      if (!listingId) continue
      const values = Array.isArray(record.metricValues) ? record.metricValues : []
      const getMetric = (key: string) => {
        const index = headerMetrics.indexOf(key)
        return index >= 0 ? Number(values[index]?.value || 0) || 0 : 0
      }
      metrics.set(listingId, {
        views: getMetric('LISTING_VIEWS_TOTAL'),
        impressions: getMetric('LISTING_IMPRESSION_TOTAL'),
        conversionRate: getMetric('SALES_CONVERSION_RATE'),
        transactions: getMetric('TRANSACTION'),
      })
    }
  }

  return { metrics, available: true, error: null as string | null }
}

function getRecommendation(input: {
  soldUnits: number
  profit: number
  roi: number
  margin: number
  watchers: number
  views: number
  listings: number
  sellThrough: number
  score: number
}) {
  const reasons: string[] = []

  if (input.soldUnits > 0) reasons.push(`${input.soldUnits} sale${input.soldUnits === 1 ? '' : 's'} in the last ${PERFORMANCE_DAYS} days`)
  if (input.profit > 0) reasons.push(`$${input.profit.toFixed(0)} tracked profit`)
  if (input.roi >= 50) reasons.push(`${input.roi.toFixed(0)}% ROI`)
  if (input.watchers > 0) reasons.push(`${input.watchers} watcher${input.watchers === 1 ? '' : 's'}`)
  if (input.views > 0) reasons.push(`${input.views} view${input.views === 1 ? '' : 's'}`)
  if (input.sellThrough >= 0.25) reasons.push(`${(input.sellThrough * 100).toFixed(0)}% sell-through`)

  if (input.score >= 72 && input.profit > 0) {
    return { action: 'List More', tone: 'green', reasons: reasons.slice(0, 3), summary: 'Strongest signal mix. Prioritize this niche when sourcing.' }
  }
  if (input.score >= 45 || input.watchers > input.listings * 2 || input.soldUnits > 0) {
    return { action: 'Test More', tone: 'gold', reasons: reasons.slice(0, 3), summary: 'Some demand is showing. Add selectively and watch margins.' }
  }

  return {
    action: 'Avoid For Now',
    tone: 'red',
    reasons: reasons.length > 0 ? reasons.slice(0, 3) : ['Low sales/engagement signal so far'],
    summary: 'Do not scale this area until demand or profit improves.',
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const credentials = await getValidEbayAccessToken(session.user.id)
    if (!credentials?.accessToken) {
      return apiOk({ connected: false, summary: null, niches: [], products: [], traffic: { available: false, error: null } })
    }

    await ensureListedAsinsFinancialColumns()

    const base = credentials.sandboxMode ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
    const [orders, listingRows] = await Promise.all([
      fetchOrders(base, credentials.accessToken),
      queryRows<ListingRow>`
        SELECT asin, title, ebay_listing_id, amazon_price, ebay_price, ebay_fee_rate, niche, category_id, category_name, listed_at, ended_at
        FROM listed_asins
        WHERE user_id = ${session.user.id}
      `,
    ])

    const listingById = new Map(listingRows.filter((row) => row.ebay_listing_id).map((row) => [String(row.ebay_listing_id), row] as const))
    const listingsByTitle = new Map<string, ListingRow[]>()
    for (const row of listingRows) {
      const normalized = normalizeTitle(String(row.title || ''))
      if (!normalized) continue
      const current = listingsByTitle.get(normalized) || []
      current.push(row)
      listingsByTitle.set(normalized, current)
    }

    const activeListingResult = await fetchActiveListingMetrics(base, credentials.accessToken)
    const allListingIds = Array.from(new Set([
      ...listingRows.map((row) => String(row.ebay_listing_id || '')).filter(Boolean),
      ...Array.from(activeListingResult.listings.keys()),
    ])).slice(0, 500)
    const trafficResult = await fetchTrafficMetrics(base, credentials.accessToken, allListingIds)

    const recentCutoff = Date.now() - PERFORMANCE_DAYS * 24 * 60 * 60 * 1000
    const recentOrders = orders.filter((order) => {
      const timestamp = new Date(order.creationDate).getTime()
      return Number.isFinite(timestamp) && timestamp >= recentCutoff && !isRefundedOrder(order)
    })

    const productMap = new Map<string, {
      listingId: string
      asin: string | null
      title: string
      niche: string
      categoryName: string | null
      revenue: number
      profit: number
      roi: number
      margin: number
      soldUnits: number
      views: number
      watchers: number
      impressions: number
      conversionRate: number | null
      listedAt: string | null
      active: boolean
      score: number
      action: string
    }>()

    const getProductRecord = (listingId: string, row?: ListingRow, active?: ActiveListingMetric, fallbackTitle?: string) => {
      const id = listingId || row?.asin || active?.listingId || `title:${row?.title || active?.title || 'unknown'}`
      const existing = productMap.get(id)
      if (existing) return existing

      const traffic = listingId ? trafficResult.metrics.get(listingId) : undefined
      const title = row?.title || active?.title || fallbackTitle || listingId || 'Unknown listing'
      const categoryName = row?.category_name || active?.categoryName || null
      const inferredNiche = inferNicheFromText(title, categoryName, row?.asin)
      const niche = row?.niche || inferredNiche || categoryName || 'Other'
      const record = {
        listingId,
        asin: row?.asin ? String(row.asin) : null,
        title,
        niche,
        categoryName,
        revenue: 0,
        profit: 0,
        roi: 0,
        margin: 0,
        soldUnits: 0,
        views: traffic?.views || active?.views || 0,
        watchers: active?.watchers || 0,
        impressions: traffic?.impressions || 0,
        conversionRate: traffic?.conversionRate ?? null,
        listedAt: row?.listed_at || null,
        active: !row?.ended_at || Boolean(active),
        score: 0,
        action: 'Watch',
      }
      productMap.set(id, record)
      return record
    }

    for (const [listingId, active] of activeListingResult.listings) {
      const row = listingById.get(listingId)
      getProductRecord(listingId, row, active)
      if (row && (!row.category_name || row.category_name !== active.categoryName || !row.category_id || row.category_id !== active.categoryId)) {
        const inferredNiche = row.niche || inferNicheFromText(row.title, active.title, active.categoryName)
        await sql`
          UPDATE listed_asins
          SET category_name = ${active.categoryName || null}, category_id = ${active.categoryId || row.category_id || null}, niche = ${inferredNiche || null}
          WHERE user_id = ${session.user.id} AND ebay_listing_id = ${listingId}
        `.catch(() => {})
      }
    }

    for (const order of recentOrders) {
      for (const [index, lineItem] of (order.lineItems || []).entries()) {
        const listingId = String(lineItem.legacyItemId || '')
        const normalizedTitle = normalizeTitle(String(lineItem.title || ''))
        const titleMatches = normalizedTitle ? listingsByTitle.get(normalizedTitle) || [] : []
        const row = listingId ? listingById.get(listingId) : titleMatches.length === 1 ? titleMatches[0] : undefined
        const active = listingId ? activeListingResult.listings.get(listingId) : undefined
        const record = getProductRecord(listingId || `${order.orderId}:${index}`, row, active, lineItem.title)
        if (lineItem.title && (!record.title || record.title === listingId || record.title === `${order.orderId}:${index}`)) record.title = lineItem.title

        const quantity = Math.max(1, Number(lineItem.quantity || 1))
        const fallbackRevenue = (order.lineItems?.length || 0) <= 1 ? parseMoney(order.pricingSummary?.total?.value) : 0
        const revenue = parseMoney(lineItem.lineItemCost?.value) || fallbackRevenue
        const amazonUnitCost = row?.amazon_price === null || row?.amazon_price === undefined ? null : parseMoney(row?.amazon_price)
        const amazonCost = amazonUnitCost === null ? null : amazonUnitCost * quantity
        const feeRate = row?.ebay_fee_rate === null || row?.ebay_fee_rate === undefined ? DEFAULT_EBAY_FEE_RATE : Number(row.ebay_fee_rate)
        const fees = revenue * feeRate
        const profit = amazonCost === null ? 0 : revenue - amazonCost - fees

        record.revenue += revenue
        record.profit += profit
        record.soldUnits += quantity
      }
    }

    const products = Array.from(productMap.values()).map((product) => {
      const costBasis = Math.max(1, product.revenue - product.profit)
      product.roi = product.profit > 0 ? (product.profit / costBasis) * 100 : 0
      product.margin = product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0
      const engagement = product.views + product.watchers * 8 + product.impressions * 0.025
      const demandScore = Math.min(35, product.soldUnits * 18 + engagement / 15)
      const profitScore = Math.min(35, Math.max(0, product.profit) / 4)
      const marginScore = Math.min(20, Math.max(0, product.margin) / 3)
      const conversionScore = product.conversionRate ? Math.min(10, product.conversionRate * 1.5) : 0
      product.score = Math.round(Math.min(100, demandScore + profitScore + marginScore + conversionScore))
      product.action = getRecommendation({
        soldUnits: product.soldUnits,
        profit: product.profit,
        roi: product.roi,
        margin: product.margin,
        watchers: product.watchers,
        views: product.views,
        listings: 1,
        sellThrough: product.soldUnits > 0 ? 1 : 0,
        score: product.score,
      }).action
      return product
    })

    const nicheMap = new Map<string, {
      name: string
      revenue: number
      profit: number
      soldUnits: number
      listings: number
      activeListings: number
      views: number
      watchers: number
      impressions: number
      conversionRate: number | null
      roi: number
      margin: number
      sellThrough: number
      avgProfitPerSale: number
      score: number
      action: string
      tone: string
      summary: string
      reasons: string[]
    }>()

    for (const product of products) {
      const name = product.niche || 'Unassigned'
      const current = nicheMap.get(name) || {
        name,
        revenue: 0,
        profit: 0,
        soldUnits: 0,
        listings: 0,
        activeListings: 0,
        views: 0,
        watchers: 0,
        impressions: 0,
        conversionRate: null,
        roi: 0,
        margin: 0,
        sellThrough: 0,
        avgProfitPerSale: 0,
        score: 0,
        action: 'Watch',
        tone: 'gold',
        summary: '',
        reasons: [],
      }
      current.revenue += product.revenue
      current.profit += product.profit
      current.soldUnits += product.soldUnits
      current.listings += 1
      current.activeListings += product.active ? 1 : 0
      current.views += product.views
      current.watchers += product.watchers
      current.impressions += product.impressions
      nicheMap.set(name, current)
    }

    const niches = Array.from(nicheMap.values()).map((niche) => {
      niche.margin = niche.revenue > 0 ? (niche.profit / niche.revenue) * 100 : 0
      const costBasis = Math.max(1, niche.revenue - niche.profit)
      niche.roi = niche.profit > 0 ? (niche.profit / costBasis) * 100 : 0
      niche.sellThrough = niche.listings > 0 ? niche.soldUnits / niche.listings : 0
      niche.avgProfitPerSale = niche.soldUnits > 0 ? niche.profit / niche.soldUnits : 0
      niche.conversionRate = niche.views > 0 ? (niche.soldUnits / niche.views) * 100 : null

      const demandScore = Math.min(35, niche.soldUnits * 12 + niche.watchers * 1.5 + niche.views / 20)
      const profitScore = Math.min(35, Math.max(0, niche.profit) / 6)
      const marginScore = Math.min(20, Math.max(0, niche.margin) / 2.5)
      const sellThroughScore = Math.min(10, niche.sellThrough * 18)
      niche.score = Math.round(Math.min(100, demandScore + profitScore + marginScore + sellThroughScore))
      const recommendation = getRecommendation({
        soldUnits: niche.soldUnits,
        profit: niche.profit,
        roi: niche.roi,
        margin: niche.margin,
        watchers: niche.watchers,
        views: niche.views,
        listings: niche.listings,
        sellThrough: niche.sellThrough,
        score: niche.score,
      })
      niche.action = recommendation.action
      niche.tone = recommendation.tone
      niche.summary = recommendation.summary
      niche.reasons = recommendation.reasons
      return niche
    }).sort((a, b) => b.score - a.score)

    const rankedProducts = products.sort((a, b) => b.score - a.score)
    const bestNiche = niches.find((niche) => niche.action === 'List More') || niches[0] || null
    const avoidNiche = [...niches].reverse().find((niche) => niche.action === 'Avoid For Now') || null

    return apiOk({
      connected: true,
      generatedAt: new Date().toISOString(),
      windowDays: PERFORMANCE_DAYS,
      traffic: {
        available: trafficResult.available,
        error: trafficResult.error,
        watcherSignalsAvailable: activeListingResult.available,
        watcherError: activeListingResult.error,
      },
      summary: {
        bestNiche: bestNiche?.name || null,
        avoidNiche: avoidNiche?.name || null,
        totalRevenue: niches.reduce((sum, niche) => sum + niche.revenue, 0),
        totalProfit: niches.reduce((sum, niche) => sum + niche.profit, 0),
        soldUnits: niches.reduce((sum, niche) => sum + niche.soldUnits, 0),
        activeListings: niches.reduce((sum, niche) => sum + niche.activeListings, 0),
        views: niches.reduce((sum, niche) => sum + niche.views, 0),
        watchers: niches.reduce((sum, niche) => sum + niche.watchers, 0),
      },
      niches,
      products: rankedProducts.slice(0, 30),
    })
  } catch (error) {
    if (error instanceof EbayReconnectRequiredError) {
      return apiError(error.message, { status: 401, code: 'RECONNECT_REQUIRED' })
    }

    if (error instanceof EbayNetworkError) {
      return apiError(error.message, { status: 503, code: 'EBAY_NETWORK_ERROR' })
    }

    return apiError(getErrorText(error, 'Unable to load performance data.'), {
      status: 500,
      code: 'PERFORMANCE_LOAD_FAILED',
    })
  }
}
