import { sql, queryRows } from '@/lib/db'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'
import { fetchAmazonProductByAsin } from '@/lib/amazon-product'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'

export function normalizeLookupTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pack|set|pcs|piece|pieces|count|with|for|the|a|an|of|to|in)\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function getTitleScore(ebayTitle: string, candidateTitle: string) {
  const ebayWords = new Set(normalizeLookupTitle(ebayTitle).split(' ').filter(Boolean))
  const candidateWords = new Set(normalizeLookupTitle(candidateTitle).split(' ').filter(Boolean))
  if (ebayWords.size === 0 || candidateWords.size === 0) return 0

  let overlap = 0
  for (const word of ebayWords) {
    if (candidateWords.has(word)) overlap += 1
  }

  return overlap / Math.max(ebayWords.size, candidateWords.size)
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function getXmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1] ? decodeXml(match[1]) : ''
}

function getXmlValues(xml: string, tag: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi')))
    .map((match) => decodeXml(match[1] || ''))
    .filter(Boolean)
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractAsinsFromText(...values: Array<string | null | undefined>) {
  const found = new Set<string>()
  for (const value of values) {
    const text = String(value || '').toUpperCase()
    for (const match of text.matchAll(/\bB[A-Z0-9]{9}\b/g)) {
      found.add(match[0])
    }
  }
  return Array.from(found)
}

type EbayItemDetails = {
  title: string
  sku: string
  description: string
  itemSpecifics: Array<{ name: string; values: string[] }>
  possibleAsins: string[]
}

export async function getEbayItemDetails(itemId: string, token: string, appId: string): Promise<EbayItemDetails | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ItemReturnDescription</DetailLevel>
  <OutputSelector>Title</OutputSelector>
  <OutputSelector>SKU</OutputSelector>
  <OutputSelector>Description</OutputSelector>
  <OutputSelector>ItemSpecifics</OutputSelector>
  <OutputSelector>PictureDetails</OutputSelector>
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
  const title = getXmlValue(text, 'Title')
  const sku = getXmlValue(text, 'SKU')
  const description = stripHtml(getXmlValue(text, 'Description'))
  const itemSpecifics = Array.from(text.matchAll(/<NameValueList>([\s\S]*?)<\/NameValueList>/gi))
    .map((match) => {
      const block = match[1] || ''
      return {
        name: getXmlValue(block, 'Name'),
        values: getXmlValues(block, 'Value'),
      }
    })
    .filter((specific) => specific.name || specific.values.length > 0)

  const specificText = itemSpecifics
    .flatMap((specific) => [specific.name, ...specific.values])
    .join(' ')

  return {
    title,
    sku,
    description,
    itemSpecifics,
    possibleAsins: extractAsinsFromText(sku, specificText, description, title),
  }
}

export async function getEbayItemTitle(itemId: string, token: string, appId: string): Promise<string | null> {
  const details = await getEbayItemDetails(itemId, token, appId)
  return details?.title || null
}

export async function saveRecoveredMapping(args: {
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

type StoredMappingRow = {
  asin?: string
  title?: string
  amazon_price?: string | number
  amazon_image_url?: string | null
  amazon_images?: unknown
  amazon_snapshot?: unknown
}

export type RecoveredAmazonMapping = {
  asin: string
  title: string
  amazonPrice: number
  imageUrl?: string
  images: string[]
  features: unknown[]
  description: string
  specs: unknown[]
  amazonUrl: string
  available: boolean
  source: 'db' | 'search'
  ebayTitle?: string
  confidence?: 'exact' | 'manual' | 'recovered' | 'search'
}

export async function recoverAmazonProductByItemId(args: {
  userId: string
  itemId: string
  accessToken: string
  appId: string
  rapidKey?: string
  excludeAsins?: string[]
}): Promise<RecoveredAmazonMapping | null> {
  const { userId, itemId, accessToken, appId, rapidKey } = args
  const excludedAsins = new Set((args.excludeAsins || []).map((asin) => asin.toUpperCase().trim()).filter(Boolean))
  const shouldSkipAsin = (asin: string) => excludedAsins.has(asin.toUpperCase().trim())

  if (excludedAsins.size === 0) {
    try {
    const rows = await queryRows<StoredMappingRow>`
      SELECT asin, title, amazon_price, amazon_image_url, amazon_images, amazon_snapshot
      FROM listed_asins
      WHERE user_id = ${userId} AND ebay_listing_id = ${itemId}
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

      const validated = await fetchAmazonProductByAsin({ asin, strictAsin: true })

      if (!validated) {
        if (storedPrice > 0) {
          const storedTitle = String(snapshot?.title || rows[0].title || asin)
          return {
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
            source: 'db',
            confidence: 'recovered',
          }
        }
      } else {
        if (validated.amazonPrice > 0) {
          await saveRecoveredMapping({
            userId,
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

        return {
          asin,
          title: String(validated.title || snapshot?.title || rows[0].title || asin),
          amazonPrice: validated.amazonPrice,
          imageUrl: validated.imageUrl || storedImageUrl,
          images: validated.images.length > 0 ? validated.images : (snapshotImages.length > 0 ? snapshotImages : storedImages),
          features: validated.features,
          description: validated.description,
          specs: validated.specs,
          amazonUrl: `https://www.amazon.com/dp/${asin}`,
          available: validated.available,
          source: 'db',
          confidence: 'recovered',
        }
      }
    }
    } catch {
      // Fall through to eBay title lookup.
    }
  }

  if (!rapidKey) return null

  const ebayDetails = await getEbayItemDetails(itemId, accessToken, appId)
  const ebayTitle = ebayDetails?.title || ''
  if (!ebayTitle) return null

  for (const asin of ebayDetails?.possibleAsins || []) {
    if (shouldSkipAsin(asin)) continue
    const validated = await fetchAmazonProductByAsin({ asin, strictAsin: true })

    if (validated) {
      await saveRecoveredMapping({
        userId,
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
          recoveredFrom: 'ebay_listing_asin',
        },
      })

      return {
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
        source: 'search',
        confidence: 'exact',
      }
    }
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
    const candidates = products
      .map((product) => ({
        asin: String(product.asin || ''),
        title: String(product.product_title || ''),
        score: getTitleScore(ebayTitle, String(product.product_title || '')),
      }))
      .filter((product) => product.asin && product.title)
      .filter((product) => !shouldSkipAsin(product.asin))
      .sort((a, b) => b.score - a.score)
    const bestCandidate = candidates[0]

    if (bestCandidate?.asin && bestCandidate.score >= 0.45) {
      const validated = await fetchAmazonProductByAsin({ asin: bestCandidate.asin, strictAsin: true })

      if (validated) {
        await saveRecoveredMapping({
          userId,
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

        return {
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
          source: 'search',
          confidence: 'search',
        }
      }
    }
  }

  const scraped = await scrapeAmazonSearch(ebayTitle)
  if (scraped.length > 0) {
    const scrapedCandidates = scraped
      .map((product) => ({
        ...product,
        score: getTitleScore(ebayTitle, product.title),
      }))
      .filter((product) => !shouldSkipAsin(product.asin))
      .sort((a, b) => b.score - a.score)
    const bestScraped = scrapedCandidates[0]

    if (bestScraped?.asin && bestScraped.score >= 0.45) {
      const validated = await fetchAmazonProductByAsin({ asin: bestScraped.asin, fallbackImage: bestScraped.imageUrl, strictAsin: true })

      if (validated) {
        await saveRecoveredMapping({
          userId,
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

        return {
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
         source: 'search',
          confidence: 'search',
       }
      }
    }

    if (bestScraped?.asin && bestScraped.price > 0) {
      await saveRecoveredMapping({
        userId,
        itemId,
        asin: bestScraped.asin,
        title: bestScraped.title,
        amazonPrice: bestScraped.price,
        amazonImageUrl: bestScraped.imageUrl,
        amazonImages: bestScraped.imageUrl ? [bestScraped.imageUrl] : [],
      })

      return {
        asin: bestScraped.asin,
        title: bestScraped.title,
        amazonPrice: bestScraped.price,
        imageUrl: bestScraped.imageUrl,
        images: bestScraped.imageUrl ? [bestScraped.imageUrl] : [],
        features: [],
        description: '',
        specs: [],
        amazonUrl: `https://www.amazon.com/dp/${bestScraped.asin}`,
        available: true,
        ebayTitle,
        source: 'search',
        confidence: 'search',
      }
    }
  }

  return null
}
