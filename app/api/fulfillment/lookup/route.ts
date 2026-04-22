import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows, sql } from '@/lib/db'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'
import { fetchAmazonProductByAsin } from '@/lib/amazon-product'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'

async function getEbayItemTitle(itemId: string, token: string, appId: string): Promise<string | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ItemReturnDescription</DetailLevel>
  <OutputSelector>Title,PictureDetails</OutputSelector>
</GetItemRequest>`

  const res = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'GetItem',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-APP-NAME': appId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/xml',
    },
    body: xml,
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return null

  const text = await res.text()
  const titleMatch = text.match(/<Title>(.*?)<\/Title>/)
  return titleMatch?.[1]?.trim() || null
}

async function saveRecoveredMapping(args: {
  userId: string
  itemId: string
  asin: string
  title: string
  amazonPrice: number
}) {
  await ensureListedAsinsFinancialColumns()
  await sql`
    INSERT INTO listed_asins (user_id, asin, title, ebay_listing_id, amazon_price)
    VALUES (${args.userId}, ${args.asin}, ${args.title.slice(0, 200)}, ${args.itemId}, ${args.amazonPrice.toFixed(2)})
    ON CONFLICT (user_id, asin) DO UPDATE SET
      title = ${args.title.slice(0, 200)},
      ebay_listing_id = ${args.itemId},
      amazon_price = ${args.amazonPrice.toFixed(2)},
      listed_at = NOW()
  `.catch(() => {})
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pack|set|pcs|piece|pieces|count|with|for|the|a|an|of|to|in)\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getTitleScore(ebayTitle: string, candidateTitle: string) {
  const ebayWords = new Set(normalizeTitle(ebayTitle).split(' ').filter(Boolean))
  const candidateWords = new Set(normalizeTitle(candidateTitle).split(' ').filter(Boolean))
  if (ebayWords.size === 0 || candidateWords.size === 0) return 0

  let overlap = 0
  for (const word of ebayWords) {
    if (candidateWords.has(word)) overlap += 1
  }

  return overlap / Math.max(ebayWords.size, candidateWords.size)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const itemId = req.nextUrl.searchParams.get('itemId')?.trim()
  if (!itemId || !/^\d+$/.test(itemId)) {
    return apiError('Invalid eBay item ID.', { status: 400, code: 'INVALID_ITEM_ID' })
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    return apiError('Amazon product lookup is not configured.', {
      status: 503,
      code: 'AMAZON_LOOKUP_NOT_CONFIGURED',
    })
  }

  try {
    const rows = await queryRows<{ asin?: string; title?: string }>`
      SELECT asin, title
      FROM listed_asins
      WHERE user_id = ${session.user.id} AND ebay_listing_id = ${itemId}
      LIMIT 1
    `

    if (rows[0]?.asin) {
      const asin = String(rows[0].asin)
      const validated = await fetchAmazonProductByAsin({ asin })

      if (!validated) {
        return apiError('Amazon lookup failed for this saved ASIN.', {
          status: 502,
          code: 'AMAZON_LOOKUP_FAILED',
        })
      }

      if (validated.amazonPrice > 0) {
        await saveRecoveredMapping({
          userId: session.user.id,
          itemId,
          asin,
          title: String(validated.title || rows[0].title || asin),
          amazonPrice: validated.amazonPrice,
        })
      }

      return apiOk({
        asin,
        title: String(validated.title || rows[0].title || asin),
        amazonPrice: validated.amazonPrice,
        imageUrl: validated.imageUrl,
        amazonUrl: `https://www.amazon.com/dp/${asin}`,
        available: validated.available,
        source: 'db' as const,
      })
    }
  } catch {
    // Fall through to the eBay lookup path.
  }

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect your account in Settings.', {
      status: 401,
      code: 'RECONNECT_REQUIRED',
    })
  }

  const appId = process.env.EBAY_APP_ID || ''
  const ebayTitle = await getEbayItemTitle(itemId, credentials.accessToken, appId)
  if (!ebayTitle) {
    return apiError(`Item #${itemId} was not found on eBay, or it is not owned by this account.`, {
      status: 404,
      code: 'ITEM_NOT_FOUND',
    })
  }

  const searchRes = await fetch(
    `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(ebayTitle)}&country=US&category_id=aps&page=1`,
    {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
      signal: AbortSignal.timeout(8000),
    }
  )

  let products: Record<string, unknown>[] = []
  if (searchRes.ok) {
    const searchJson = await searchRes.json()
    products = searchJson?.data?.products || []
  }

  if (products.length > 0) {
    const bestCandidate = products
      .map((product) => ({
        asin: String(product.asin || ''),
        title: String(product.product_title || ''),
        score: getTitleScore(ebayTitle, String(product.product_title || '')),
      }))
      .filter((product) => product.asin && product.title)
      .sort((a, b) => b.score - a.score)[0]

    if (bestCandidate?.asin && bestCandidate.score >= 0.45) {
      const validated = await fetchAmazonProductByAsin({ asin: bestCandidate.asin })

      if (validated) {
        await saveRecoveredMapping({
          userId: session.user.id,
          itemId,
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
        })

        return apiOk({
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          imageUrl: validated.imageUrl,
          amazonUrl: `https://www.amazon.com/dp/${validated.asin}`,
          available: validated.available,
          ebayTitle,
          source: 'search' as const,
        })
      }
    }
  }

  const scraped = await scrapeAmazonSearch(ebayTitle)
  if (scraped.length > 0) {
    const bestScraped = scraped
      .map((product) => ({
        ...product,
        score: getTitleScore(ebayTitle, product.title),
      }))
      .sort((a, b) => b.score - a.score)[0]

    if (bestScraped?.asin && bestScraped.score >= 0.45) {
      const validated = await fetchAmazonProductByAsin({ asin: bestScraped.asin, fallbackImage: bestScraped.imageUrl })

      if (validated) {
        await saveRecoveredMapping({
          userId: session.user.id,
          itemId,
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
        })

        return apiOk({
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          imageUrl: validated.imageUrl,
          amazonUrl: `https://www.amazon.com/dp/${validated.asin}`,
          available: validated.available,
          ebayTitle,
          source: 'search' as const,
        })
      }
    }

    if (bestScraped?.asin && bestScraped.price > 0) {
      await saveRecoveredMapping({
        userId: session.user.id,
        itemId,
        asin: bestScraped.asin,
        title: bestScraped.title,
        amazonPrice: bestScraped.price,
      })
    }
  }

  return apiError(`No Amazon match was found for "${ebayTitle.slice(0, 60)}". Try the title manually if this listing uses custom wording.`, {
    status: 404,
    code: 'AMAZON_MATCH_NOT_FOUND',
  })
}
