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
  amazonImageUrl?: string
  amazonImages?: string[]
  amazonSnapshot?: Record<string, unknown>
}) {
  await ensureListedAsinsFinancialColumns()
  await sql`
    INSERT INTO listed_asins (user_id, asin, title, ebay_listing_id, amazon_price, amazon_image_url, amazon_images, amazon_snapshot)
    VALUES (${args.userId}, ${args.asin}, ${args.title.slice(0, 200)}, ${args.itemId}, ${args.amazonPrice.toFixed(2)}, ${args.amazonImageUrl || null}, ${JSON.stringify(args.amazonImages || [])}, ${JSON.stringify(args.amazonSnapshot || null)})
    ON CONFLICT (user_id, asin) DO UPDATE SET
      title = ${args.title.slice(0, 200)},
      ebay_listing_id = ${args.itemId},
      amazon_price = ${args.amazonPrice.toFixed(2)},
      amazon_image_url = ${args.amazonImageUrl || null},
      amazon_images = ${JSON.stringify(args.amazonImages || [])},
      amazon_snapshot = COALESCE(${JSON.stringify(args.amazonSnapshot || null)}::jsonb, listed_asins.amazon_snapshot),
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
    const rows = await queryRows<{ asin?: string; title?: string; amazon_price?: string | number; amazon_image_url?: string | null; amazon_images?: unknown; amazon_snapshot?: unknown }>`
      SELECT asin, title, amazon_price, amazon_image_url, amazon_images, amazon_snapshot
      FROM listed_asins
      WHERE user_id = ${session.user.id} AND ebay_listing_id = ${itemId}
      LIMIT 1
    `

    if (rows[0]?.asin) {
      const asin = String(rows[0].asin)
      const snapshot = rows[0].amazon_snapshot && typeof rows[0].amazon_snapshot === 'object'
        ? rows[0].amazon_snapshot as Record<string, unknown>
        : null
      const storedPrice = parseFloat(String(rows[0].amazon_price || '0')) || 0
      const storedImages = Array.isArray(rows[0].amazon_images)
        ? rows[0].amazon_images.map((value) => String(value || '')).filter((value) => value.startsWith('http'))
        : []
      const snapshotImages = Array.isArray(snapshot?.images)
        ? snapshot.images.map((value) => String(value || '')).filter((value) => value.startsWith('http'))
        : []
      const storedImageUrl =
        String(snapshot?.imageUrl || '') ||
        String(rows[0].amazon_image_url || '') ||
        snapshotImages[0] ||
        storedImages[0] ||
        undefined

      if (snapshot && storedPrice > 0) {
        return apiOk({
          asin,
          title: String(snapshot.title || rows[0].title || asin),
          amazonPrice: storedPrice,
          imageUrl: storedImageUrl,
          images: snapshotImages.length > 0 ? snapshotImages : storedImages,
          features: Array.isArray(snapshot.features) ? snapshot.features : [],
          description: String(snapshot.description || ''),
          specs: Array.isArray(snapshot.specs) ? snapshot.specs : [],
          amazonUrl: String(snapshot.amazonUrl || `https://www.amazon.com/dp/${asin}`),
          available: true,
          source: 'db' as const,
        })
      }

      const validated = await fetchAmazonProductByAsin({ asin, strictAsin: true })

      if (!validated) {
        if (storedPrice > 0) {
          const storedTitle = String(snapshot?.title || rows[0].title || asin)
          return apiOk({
            asin,
            title: storedTitle,
            amazonPrice: storedPrice,
            imageUrl: storedImageUrl,
            images: snapshotImages.length > 0 ? snapshotImages : storedImages,
            features: Array.isArray(snapshot?.features) ? snapshot.features : [],
            description: String(snapshot?.description || ''),
            specs: Array.isArray(snapshot?.specs) ? snapshot.specs : [],
            amazonUrl: String(
              snapshot?.amazonUrl ||
              (storedTitle ? `https://www.amazon.com/s?k=${encodeURIComponent(storedTitle)}` : `https://www.amazon.com/dp/${asin}`)
            ),
            available: true,
            source: 'db' as const,
          })
        }
      } else {
        if (validated.amazonPrice > 0) {
          await saveRecoveredMapping({
            userId: session.user.id,
            itemId,
            asin,
            title: String(validated.title || rows[0].title || asin),
            amazonPrice: validated.amazonPrice,
            amazonImageUrl: validated.imageUrl,
            amazonImages: validated.images,
            amazonSnapshot: {
              asin: validated.asin,
              title: validated.title,
              amazonPrice: validated.amazonPrice,
              imageUrl: validated.imageUrl,
              images: validated.images,
              features: validated.features,
              description: validated.description,
              specs: validated.specs,
              available: validated.available,
              source: validated.source,
              amazonUrl: `https://www.amazon.com/dp/${validated.asin}`,
            },
          })
        }

        return apiOk({
          asin,
          title: String(validated.title || rows[0].title || asin),
          amazonPrice: validated.amazonPrice,
          imageUrl: validated.imageUrl,
          images: validated.images,
          features: validated.features,
          description: validated.description,
          specs: validated.specs,
          amazonUrl: `https://www.amazon.com/dp/${asin}`,
          available: validated.available,
          source: 'db' as const,
        })
      }
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
      const validated = await fetchAmazonProductByAsin({ asin: bestCandidate.asin, strictAsin: true })

      if (validated) {
        await saveRecoveredMapping({
          userId: session.user.id,
          itemId,
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          amazonImageUrl: validated.imageUrl,
          amazonImages: validated.images,
          amazonSnapshot: {
            asin: validated.asin,
            title: validated.title,
            amazonPrice: validated.amazonPrice,
            imageUrl: validated.imageUrl,
            images: validated.images,
            features: validated.features,
            description: validated.description,
            specs: validated.specs,
            available: validated.available,
            source: validated.source,
            amazonUrl: `https://www.amazon.com/dp/${validated.asin}`,
          },
        })

        return apiOk({
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          imageUrl: validated.imageUrl,
          images: validated.images,
          features: validated.features,
          description: validated.description,
          specs: validated.specs,
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
      const validated = await fetchAmazonProductByAsin({ asin: bestScraped.asin, fallbackImage: bestScraped.imageUrl, strictAsin: true })

      if (validated) {
        await saveRecoveredMapping({
          userId: session.user.id,
          itemId,
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          amazonImageUrl: validated.imageUrl,
          amazonImages: validated.images,
          amazonSnapshot: {
            asin: validated.asin,
            title: validated.title,
            amazonPrice: validated.amazonPrice,
            imageUrl: validated.imageUrl,
            images: validated.images,
            features: validated.features,
            description: validated.description,
            specs: validated.specs,
            available: validated.available,
            source: validated.source,
            amazonUrl: `https://www.amazon.com/dp/${validated.asin}`,
          },
        })

        return apiOk({
          asin: validated.asin,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          imageUrl: validated.imageUrl,
          images: validated.images,
          features: validated.features,
          description: validated.description,
          specs: validated.specs,
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
        amazonImageUrl: bestScraped.imageUrl,
        amazonImages: bestScraped.imageUrl ? [bestScraped.imageUrl] : [],
      })
    }
  }

  return apiError(`No Amazon match was found for "${ebayTitle.slice(0, 60)}". Try the title manually if this listing uses custom wording.`, {
    status: 404,
    code: 'AMAZON_MATCH_NOT_FOUND',
  })
}
