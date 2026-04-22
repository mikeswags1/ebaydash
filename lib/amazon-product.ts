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
  features: string[]
  description: string
  specs: Array<[string, string]>
  brand?: string
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
  features: unknown
  description: string | null
  specs: unknown
  brand: string | null
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

function sanitizeText(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeImages(values: string[]) {
  return Array.from(new Set(values.filter((url) => url.startsWith('http'))))
}

function normalizeFeatures(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((entry) => sanitizeText(entry))
        .filter((entry) => entry.length > 6)
        .slice(0, 12)
    )
  )
}

function normalizeSpecs(value: unknown) {
  if (!Array.isArray(value)) return []
  const specs: Array<[string, string]> = []
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const key = sanitizeText(entry[0]).slice(0, 120)
    const val = sanitizeText(entry[1]).slice(0, 300)
    if (!key || !val) continue
    specs.push([key, val])
    if (specs.length >= 20) break
  }
  return specs
}

function inferBrand(title: string, specs: Array<[string, string]>, brand?: string) {
  const direct = sanitizeText(brand)
  if (direct) return direct
  const specBrand = specs.find(([key]) => /brand/i.test(key))
  if (specBrand?.[1]) return sanitizeText(specBrand[1])
  const firstWord = sanitizeTitle(title).split(/\s+/)[0] || ''
  return firstWord.length > 1 ? firstWord : ''
}

function toSpecEntries(value: unknown) {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>)
    .map(([key, val]) => [sanitizeText(key), sanitizeText(val)] as [string, string])
    .filter(([key, val]) => key.length > 1 && val.length > 1)
    .slice(0, 16)
}

function mergeProducts(asin: string, products: Array<ValidatedAmazonProduct | null>, options: FetchAmazonProductOptions) {
  const validProducts = products.filter((product): product is ValidatedAmazonProduct => Boolean(product))
  if (validProducts.length === 0) return null

  const preferred =
    validProducts.find((product) => product.source === 'api') ||
    validProducts.find((product) => product.source === 'scrape') ||
    validProducts[0]

  const images = dedupeImages([
    ...validProducts.flatMap((product) => product.images),
    normalizeImageUrl(options.fallbackImage),
  ])

  return toProduct({
    asin,
    title: preferred.title,
    amazonPrice: preferred.amazonPrice,
    images,
    features: validProducts.flatMap((product) => product.features),
    description: validProducts.find((product) => product.description)?.description || '',
    specs: validProducts.flatMap((product) => product.specs),
    brand: preferred.brand,
    available: validProducts.some((product) => product.available),
    source: preferred.source,
    fallbackTitle: options.fallbackTitle,
    fallbackPrice: options.fallbackPrice,
  })
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
  features?: unknown
  description?: unknown
  specs?: unknown
  brand?: string
  available?: boolean
  source: ValidatedAmazonProduct['source']
  fallbackTitle?: string
  fallbackPrice?: number
}): ValidatedAmazonProduct | null {
  const title = sanitizeTitle(input.title || input.fallbackTitle)
  const images = dedupeImages(input.images || [])
  const features = normalizeFeatures(input.features)
  const description = sanitizeText(input.description)
  const specs = normalizeSpecs(input.specs)
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
    features,
    description,
    specs,
    brand: inferBrand(title, specs, input.brand),
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
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      description TEXT,
      specs JSONB NOT NULL DEFAULT '[]'::jsonb,
      brand TEXT,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      source TEXT NOT NULL DEFAULT 'api',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {})
  await sql`ALTER TABLE amazon_product_cache ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb`.catch(() => {})
  await sql`ALTER TABLE amazon_product_cache ADD COLUMN IF NOT EXISTS description TEXT`.catch(() => {})
  await sql`ALTER TABLE amazon_product_cache ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '[]'::jsonb`.catch(() => {})
  await sql`ALTER TABLE amazon_product_cache ADD COLUMN IF NOT EXISTS brand TEXT`.catch(() => {})
}

async function loadCachedAmazonProduct(asin: string): Promise<ValidatedAmazonProduct | null> {
  await ensureAmazonProductCacheTable()
  const rows = await queryRows<CachedAmazonProduct>`
    SELECT asin, title, amazon_price, images, primary_image, features, description, specs, brand, available
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
    features: cached.features,
    description: cached.description,
    specs: cached.specs,
    brand: sanitizeText(cached.brand),
    available: cached.available ?? true,
    source: 'cache',
  })
}

async function saveCachedAmazonProduct(product: ValidatedAmazonProduct) {
  await ensureAmazonProductCacheTable()
  await sql`
    INSERT INTO amazon_product_cache (asin, title, amazon_price, primary_image, images, features, description, specs, brand, available, source, updated_at)
    VALUES (
      ${product.asin},
      ${product.title.slice(0, 500)},
      ${product.amazonPrice.toFixed(2)},
      ${product.imageUrl || null},
      ${JSON.stringify(product.images)},
      ${JSON.stringify(product.features)},
      ${product.description || null},
      ${JSON.stringify(product.specs)},
      ${product.brand || null},
      ${product.available},
      ${product.source},
      NOW()
    )
    ON CONFLICT (asin) DO UPDATE SET
      title = EXCLUDED.title,
      amazon_price = EXCLUDED.amazon_price,
      primary_image = EXCLUDED.primary_image,
      images = EXCLUDED.images,
      features = EXCLUDED.features,
      description = EXCLUDED.description,
      specs = EXCLUDED.specs,
      brand = EXCLUDED.brand,
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
      features:
        data.about_product ||
        data.feature_bullets ||
        data.bullet_points ||
        data.product_features ||
        data.highlights ||
        [],
      description:
        data.product_description ||
        data.description ||
        data.synopsis ||
        data.product_information ||
        '',
      specs: [
        ...toSpecEntries(data.product_overview),
        ...toSpecEntries(data.product_details),
      ],
      brand: sanitizeText((data as Record<string, unknown>).product_byline || (data as Record<string, unknown>).brand),
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
      brand: sanitizeText(match.product_byline || ''),
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
    features: scraped.features,
    specs: scraped.specs,
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
  const [apiResult, searchResult, scrapeResult] = await Promise.all([
    fetchProductDetailsFromApi(asin, options.fallbackImage),
    fetchProductFromSearch(asin, options.fallbackImage),
    fetchProductFromScrape(asin, options.fallbackImage),
  ])

  const merged = mergeProducts(asin, [apiResult, searchResult, scrapeResult], options)
  if (merged) {
    await saveCachedAmazonProduct(merged)
    return merged
  }

  if (cached) {
    return toProduct({
      asin,
      title: cached.title,
      amazonPrice: cached.amazonPrice,
      images: dedupeImages([...cached.images, normalizeImageUrl(options.fallbackImage)]),
      features: cached.features,
      description: cached.description,
      specs: cached.specs,
      brand: cached.brand,
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
    features: [],
    description: '',
    specs: [],
    available: Number(options.fallbackPrice || 0) > 0,
    source: 'fallback',
    fallbackTitle: options.fallbackTitle,
    fallbackPrice: options.fallbackPrice,
  })
}
