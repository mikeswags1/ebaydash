import { queryRows, sql } from '@/lib/db'
import { scrapeAmazonProduct, scrapeAmazonSearch } from '@/lib/amazon-scrape'

type FetchAmazonProductOptions = {
  asin: string
  fallbackImage?: string
  fallbackTitle?: string
  fallbackPrice?: number
}

export type ValidatedAmazonProduct = {
  asin: string
  title: string
  amazonPrice: number
  images: string[]
  imageUrl?: string
  available: boolean
  source: 'api' | 'search' | 'scrape' | 'cache' | 'fallback'
  usedFallbackTitle?: boolean
  usedFallbackPrice?: boolean
}

type CachedAmazonProduct = {
  asin: string
  title: string
  amazon_price: string | number
  images: unknown
  primary_image: string | null
  available: boolean | null
}

function normalizeImageUrl(value: unknown) {
  const url = String(value || '').trim()
  return url.startsWith('http') ? url : ''
}

function parseAmazonPrice(value: unknown) {
  if (typeof value === 'number') return value
  const parsed = parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function sanitizeTitle(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeImages(values: string[]) {
  return Array.from(new Set(values.filter((url) => url.startsWith('http'))))
}

function normalizeCachedImages(value: unknown) {
  if (!Array.isArray(value)) return []
  return dedupeImages(value.map((entry) => normalizeImageUrl(entry)))
}

function toProduct(input: {
  asin: string
  title?: string
  amazonPrice?: number
  images?: string[]
  available?: boolean
  source: ValidatedAmazonProduct['source']
  fallbackTitle?: string
  fallbackPrice?: number
}): ValidatedAmazonProduct | null {
  const title = sanitizeTitle(input.title || input.fallbackTitle)
  const images = dedupeImages(input.images || [])
  const recoveredPrice = Number.isFinite(input.amazonPrice) ? Number(input.amazonPrice) : 0
  const fallbackPrice = Number.isFinite(input.fallbackPrice) ? Number(input.fallbackPrice) : 0
  const amazonPrice = recoveredPrice > 0 ? recoveredPrice : fallbackPrice

  if (!title || amazonPrice <= 0) return null

  return {
    asin: input.asin,
    title,
    amazonPrice,
    images,
    imageUrl: images[0],
    available: input.available ?? amazonPrice > 0,
    source: input.source,
    usedFallbackTitle: !sanitizeTitle(input.title) && Boolean(input.fallbackTitle),
    usedFallbackPrice: recoveredPrice <= 0 && fallbackPrice > 0,
  }
}

async function ensureAmazonProductCacheTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS amazon_product_cache (
      asin TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amazon_price NUMERIC(10,2) NOT NULL,
      primary_image TEXT,
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      source TEXT NOT NULL DEFAULT 'api',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {})
}

async function loadCachedAmazonProduct(asin: string): Promise<ValidatedAmazonProduct | null> {
  await ensureAmazonProductCacheTable()
  const rows = await queryRows<CachedAmazonProduct>`
    SELECT asin, title, amazon_price, images, primary_image, available
    FROM amazon_product_cache
    WHERE asin = ${asin}
    LIMIT 1
  `.catch(() => [])

  const cached = rows[0]
  if (!cached) return null

  const images = dedupeImages([
    normalizeImageUrl(cached.primary_image),
    ...normalizeCachedImages(cached.images),
  ])

  return toProduct({
    asin,
    title: cached.title,
    amazonPrice: parseAmazonPrice(cached.amazon_price),
    images,
    available: cached.available ?? true,
    source: 'cache',
  })
}

async function saveCachedAmazonProduct(product: ValidatedAmazonProduct) {
  await ensureAmazonProductCacheTable()
  await sql`
    INSERT INTO amazon_product_cache (asin, title, amazon_price, primary_image, images, available, source, updated_at)
    VALUES (
      ${product.asin},
      ${product.title.slice(0, 500)},
      ${product.amazonPrice.toFixed(2)},
      ${product.imageUrl || null},
      ${JSON.stringify(product.images)},
      ${product.available},
      ${product.source},
      NOW()
    )
    ON CONFLICT (asin) DO UPDATE SET
      title = EXCLUDED.title,
      amazon_price = EXCLUDED.amazon_price,
      primary_image = EXCLUDED.primary_image,
      images = EXCLUDED.images,
      available = EXCLUDED.available,
      source = EXCLUDED.source,
      updated_at = NOW()
  `.catch(() => {})
}

async function fetchProductDetailsFromApi(asin: string, fallbackImage?: string) {
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return null

  try {
    const url = `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.status === 429 || res.status === 403) return null

    const json = await res.json()
    const data = json?.data ?? json
    const quotaMsg = String(data?.message || '').toLowerCase()
    if (quotaMsg.match(/limit|quota|exceed/)) return null

    const rawPhotos: unknown[] = Array.isArray(data.product_photos) ? data.product_photos : []
    const images = dedupeImages([
      ...rawPhotos.flatMap((photo: unknown) => {
        if (typeof photo === 'string') return [photo]
        if (photo && typeof photo === 'object') {
          const record = photo as Record<string, unknown>
          return [
            normalizeImageUrl(record.url),
            normalizeImageUrl(record.large),
            normalizeImageUrl(record.hiRes),
            normalizeImageUrl(record.main),
            normalizeImageUrl(record.thumb),
          ]
        }
        return []
      }),
      normalizeImageUrl(data.product_photo),
      normalizeImageUrl(fallbackImage),
    ])

    return toProduct({
      asin,
      title: data.product_title || data.title,
      amazonPrice: parseAmazonPrice(data.product_price || data.price),
      images,
      available:
        String(data.product_availability || '').toLowerCase() !== 'currently unavailable' &&
        parseAmazonPrice(data.product_price || data.price) > 0,
      source: 'api',
    })
  } catch {
    return null
  }
}

async function fetchProductFromSearch(asin: string, fallbackImage?: string) {
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return null

  try {
    const url = `https://real-time-amazon-data.p.rapidapi.com/search?query=${asin}&country=US&category_id=aps&page=1`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null

    const json = await res.json()
    const products: Record<string, unknown>[] = json?.data?.products || []
    const match = products.find((product) => String(product.asin || '').toUpperCase() === asin)
    if (!match) return null

    return toProduct({
      asin,
      title: String(match.product_title || ''),
      amazonPrice: parseAmazonPrice(match.product_price || match.product_original_price),
      images: [
        normalizeImageUrl(match.product_photo),
        normalizeImageUrl(fallbackImage),
      ],
      available: parseAmazonPrice(match.product_price || match.product_original_price) > 0,
      source: 'search',
    })
  } catch {
    return null
  }
}

async function fetchProductFromScrape(asin: string, fallbackImage?: string) {
  const scraped = await scrapeAmazonProduct(asin).catch(() => null)
  if (!scraped) return null

  return toProduct({
    asin,
    title: scraped.title,
    amazonPrice: scraped.price,
    images: [...scraped.images, normalizeImageUrl(fallbackImage)],
    available: scraped.available && scraped.price > 0,
    source: 'scrape',
  })
}

async function fetchSearchFallbackByTitle(title: string, fallbackImage?: string, fallbackPrice?: number) {
  const query = sanitizeTitle(title)
  if (!query) return null

  const scraped = await scrapeAmazonSearch(query).catch(() => [])
  const top = scraped[0]
  if (!top?.asin) return null

  const byAsin = await fetchProductFromSearch(top.asin, top.imageUrl || fallbackImage)
  if (byAsin) return byAsin

  return toProduct({
    asin: top.asin,
    title: top.title,
    amazonPrice: top.price,
    images: [top.imageUrl, normalizeImageUrl(fallbackImage)],
    available: top.price > 0,
    source: 'search',
    fallbackPrice,
  })
}

export async function fetchAmazonProductByAsin(
  options: FetchAmazonProductOptions
): Promise<ValidatedAmazonProduct | null> {
  const asin = options.asin.toUpperCase().trim()
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null

  const cached = await loadCachedAmazonProduct(asin)

  const attempts = [
    () => fetchProductDetailsFromApi(asin, options.fallbackImage),
    () => fetchProductFromSearch(asin, options.fallbackImage),
    () => fetchProductFromScrape(asin, options.fallbackImage),
  ]

  for (const attempt of attempts) {
    const result = await attempt()
    if (result) {
      await saveCachedAmazonProduct(result)
      return result
    }
  }

  if (cached) {
    return toProduct({
      asin,
      title: cached.title,
      amazonPrice: cached.amazonPrice,
      images: dedupeImages([...cached.images, normalizeImageUrl(options.fallbackImage)]),
      available: cached.available,
      source: 'cache',
      fallbackTitle: options.fallbackTitle,
      fallbackPrice: options.fallbackPrice,
    })
  }

  const titleFallback = await fetchSearchFallbackByTitle(
    options.fallbackTitle || '',
    options.fallbackImage,
    options.fallbackPrice
  )
  if (titleFallback) {
    await saveCachedAmazonProduct(titleFallback)
    return titleFallback
  }

  return toProduct({
    asin,
    title: options.fallbackTitle || `Item ${asin}`,
    amazonPrice: options.fallbackPrice,
    images: dedupeImages([normalizeImageUrl(options.fallbackImage)]),
    available: Number(options.fallbackPrice || 0) > 0,
    source: 'fallback',
    fallbackTitle: options.fallbackTitle,
    fallbackPrice: options.fallbackPrice,
  })
}
