import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows } from '@/lib/db'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'
import { EBAY_DEFAULT_FEE_RATE, getListingMetrics } from '@/lib/listing-pricing'
import { isWeakListingTitle } from '@/lib/listing-quality'

type ListingAuditRow = {
  asin: string | null
  title: string | null
  ebay_listing_id: string | null
  amazon_price: string | number | null
  ebay_price: string | number | null
  amazon_images: unknown
  cache_price: string | number | null
  cache_available: boolean | null
  cache_updated_at: string | null
}

async function ebayGet(token: string, path: string) {
  const res = await fetch(`https://api.ebay.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`eBay API request failed (${res.status})`)
  }

  return res.json()
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function jsonArrayLength(value: unknown) {
  if (Array.isArray(value)) return value.length
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch {
      return 0
    }
  }
  return 0
}

async function auditActiveListings(userId: string | number) {
  await ensureListedAsinsFinancialColumns()
  const rows = await queryRows<ListingAuditRow>`
    SELECT
      la.asin,
      la.title,
      la.ebay_listing_id,
      la.amazon_price,
      la.ebay_price,
      la.amazon_images,
      apc.amazon_price AS cache_price,
      apc.available AS cache_available,
      apc.updated_at AS cache_updated_at
    FROM listed_asins la
    LEFT JOIN amazon_product_cache apc ON apc.asin = la.asin
    WHERE la.user_id = ${userId}
      AND la.ended_at IS NULL
      AND la.ebay_listing_id IS NOT NULL
    ORDER BY la.listed_at DESC
    LIMIT 500
  `.catch(() => [])

  const issues = {
    weakTitle: 0,
    lowImages: 0,
    missingCache: 0,
    unavailable: 0,
    stalePrice: 0,
    marginRisk: 0,
  }
  const examples: string[] = []

  for (const row of rows) {
    const asin = String(row.asin || 'Unknown')
    const title = String(row.title || '')
    const listingPrice = toNumber(row.ebay_price)
    const listedAmazonPrice = toNumber(row.amazon_price)
    const cachePrice = toNumber(row.cache_price)
    const bestAmazonPrice = cachePrice || listedAmazonPrice
    const rowIssues: string[] = []

    if (isWeakListingTitle(title)) {
      issues.weakTitle += 1
      rowIssues.push('weak title')
    }
    if (jsonArrayLength(row.amazon_images) < 2) {
      issues.lowImages += 1
      rowIssues.push('fewer than 2 images')
    }
    if (!row.cache_updated_at) {
      issues.missingCache += 1
      rowIssues.push('not in Amazon cache')
    }
    if (row.cache_updated_at && (row.cache_available === false || cachePrice === 0)) {
      issues.unavailable += 1
      rowIssues.push('Amazon unavailable')
    }
    if (cachePrice > 0 && listedAmazonPrice > 0) {
      const drift = Math.abs(cachePrice - listedAmazonPrice) / Math.max(listedAmazonPrice, 1)
      if (drift > 0.15) {
        issues.stalePrice += 1
        rowIssues.push('Amazon price drift')
      }
    }
    if (bestAmazonPrice > 0 && listingPrice > 0) {
      const metrics = getListingMetrics(bestAmazonPrice, listingPrice, EBAY_DEFAULT_FEE_RATE)
      if (metrics.profit < 1 || metrics.roi < 10) {
        issues.marginRisk += 1
        rowIssues.push('margin risk')
      }
    }

    if (rowIssues.length > 0 && examples.length < 4) {
      examples.push(`${asin}: ${rowIssues.join(', ')}`)
    }
  }

  const totalIssues = Object.values(issues).reduce((sum, count) => sum + count, 0)
  const summary = totalIssues === 0
    ? `Audited ${rows.length} active listing${rows.length === 1 ? '' : 's'}. No local quality issues found.`
    : `Audited ${rows.length} active listing${rows.length === 1 ? '' : 's'}. Issues: ${issues.weakTitle} weak title, ${issues.lowImages} low-image, ${issues.unavailable} unavailable, ${issues.stalePrice} stale-price, ${issues.marginRisk} margin-risk.`

  return examples.length > 0 ? `${summary} Examples: ${examples.join(' | ')}` : summary
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const script = req.nextUrl.searchParams.get('script')
  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('eBay is not connected. Open Settings and reconnect your account.', {
      status: 401,
      code: 'RECONNECT_REQUIRED',
    })
  }

  try {
    switch (script) {
      case 'check-orders.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/fulfillment/v1/order?limit=50&orderFulfillmentStatus=NOT_STARTED')
        const count = data.total || 0
        return apiOk({ message: `Found ${count} order${count !== 1 ? 's' : ''} needing shipment.` })
      }

      case 'listing-audit.js': {
        const message = await auditActiveListings(session.user.id)
        return apiOk({ message })
      }

      case 'auto-feedback.js':
        return apiOk({ message: 'eBay no longer allows sellers to initiate buyer messages through the API. Send feedback requests manually from My eBay > Sold.' })

      case 'fix-campaigns.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/marketing/v1/ad_campaign?limit=10')
        const campaigns = data.campaigns || []
        const paused = campaigns.filter((campaign: { campaignStatus: string }) => campaign.campaignStatus === 'PAUSED').length
        return apiOk({ message: `Found ${campaigns.length} campaign(s); ${paused} are paused. Review them in eBay Seller Hub > Marketing.` })
      }

      case 'delete-low-roi.js':
        return apiOk({ message: 'This script permanently deletes listings. Run it locally for safety: node delete-low-roi.js' })

      case 'audit-and-clean.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/inventory/v1/inventory_item?limit=200')
        const count = data.total || (data.inventoryItems?.length ?? 0)
        return apiOk({ message: `Found ${count} inventory item(s). Run the full audit locally with: node audit-and-clean.js` })
      }

      case 'delete-dead-listings.js':
        return apiOk({ message: 'Deletion scripts run locally for safety. Use: node delete-dead-listings.js' })

      case 'optimize-titles.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/inventory/v1/inventory_item?limit=200')
        const count = data.total || (data.inventoryItems?.length ?? 0)
        return apiOk({ message: `Found ${count} listing(s). Title optimization runs locally: node optimize-titles.js` })
      }

      case 'optimize-titles-apply.js':
        return apiOk({ message: 'Title changes apply live to your listings. Run locally after reviewing the report: node optimize-titles-apply.js' })

      case 'auto-lister.js':
        return apiOk({ message: 'Auto-lister requires a product data file. Run locally: node auto-lister.js' })

      case 'update-descriptions.js':
        return apiOk({ message: 'Description updates run locally. Use: node update-descriptions.js' })

      case 'sync-amazon-costs.js':
        return apiOk({ message: 'Cost sync runs locally. Use: node sync-amazon-costs.js or check prices manually in the ASIN tab.' })

      default:
        return apiError('Script not recognized.', { status: 400, code: 'UNKNOWN_SCRIPT' })
    }
  } catch (error) {
    return apiError(getErrorText(error, 'Failed to run script.'), {
      status: 500,
      code: 'SCRIPT_RUN_FAILED',
    })
  }
}
