import { queryRows, sql } from '@/lib/db'
import { EBAY_DEFAULT_FEE_RATE, getListingMetrics, getRecommendedEbayPrice } from '@/lib/listing-pricing'
import { getListingPolicyFlags, hasBlockedListingPolicyFlag } from '@/lib/listing-policy'

export type SourceEngineProduct = {
  asin: string
  title: string
  amazonPrice: number
  ebayPrice: number
  profit: number
  roi: number
  imageUrl?: string
  risk: string
  salesVolume?: string
  images?: string[]
  features?: string[]
  description?: string
  specs?: Array<[string, string]>
  sourceNiche?: string
  qualityScore?: number
  _rating?: number
  _numRatings?: number
}

type SourceProductInput = Partial<SourceEngineProduct> & {
  asin: string
  title: string
  sourceProvider?: string
  sourceQuery?: string
  raw?: unknown
}

type ProductSourceRow = {
  asin: string
  title: string
  source_niche: string | null
  amazon_price: string | number | null
  ebay_price: string | number | null
  profit: string | number | null
  roi: string | number | null
  image_url: string | null
  risk: string | null
  sales_volume: string | null
  rating: string | number | null
  review_count: string | number | null
  total_score: string | number | null
  raw: Record<string, unknown> | null
}

type ProductCacheRow = {
  niche: string
  results: SourceEngineProduct[]
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseSales(value?: string) {
  if (!value) return 1
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function compactJson(value: unknown) {
  if (!value || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

function getRisk(price: number, roi: number) {
  if (price > 150) return 'HIGH'
  if (price > 60 || roi < 45) return 'MEDIUM'
  return 'LOW'
}

function scoreProduct(product: SourceEngineProduct) {
  const rating = product._rating && product._rating > 0 ? product._rating : 3.8
  const reviews = product._numRatings || 0
  const sales = parseSales(product.salesVolume)
  const margin = product.ebayPrice > 0 ? (product.profit / product.ebayPrice) * 100 : 0
  const demandScore =
    Math.log10(sales + 10) * 18 +
    Math.log10(reviews + 25) * 14 +
    clamp(rating / 5, 0.65, 1.05) * 18
  const profitScore = clamp(product.profit, 0, 120)
  const roiScore = clamp(product.roi / 70, 0.35, 1.8) * 24
  const marginScore = clamp(margin / 32, 0.35, 1.5) * 18
  const priceSweetSpot = product.amazonPrice >= 12 && product.amazonPrice <= 120 ? 18 : product.amazonPrice > 180 ? 7 : 12
  const riskPenalty = product.risk === 'HIGH' ? 0.72 : product.risk === 'MEDIUM' ? 0.9 : 1
  const imageBoost = product.imageUrl ? 6 : -8
  const total = (profitScore + roiScore + marginScore + demandScore + priceSweetSpot + imageBoost) * riskPenalty
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0
}

function normalizeProduct(input: SourceProductInput): (SourceEngineProduct & { sourceProvider: string; sourceQuery?: string; raw: Record<string, unknown> }) | null {
  const asin = String(input.asin || '').trim().toUpperCase()
  const title = String(input.title || '').trim()
  const amazonPrice = parseNumber(input.amazonPrice)
  if (!asin || !title || amazonPrice <= 0) return null

  const ebayPrice = getRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
  const metrics = getListingMetrics(amazonPrice, ebayPrice, EBAY_DEFAULT_FEE_RATE)
  const profit = metrics.profit
  const roi = metrics.roi
  const risk = input.risk || getRisk(amazonPrice, roi)
  const product: SourceEngineProduct & { sourceProvider: string; sourceQuery?: string; raw: Record<string, unknown> } = {
    asin,
    title,
    amazonPrice,
    ebayPrice,
    profit,
    roi,
    imageUrl: input.imageUrl,
    risk,
    salesVolume: input.salesVolume,
    images: input.images,
    features: input.features,
    description: input.description,
    specs: input.specs,
    sourceNiche: input.sourceNiche,
    _rating: input._rating,
    _numRatings: input._numRatings,
    sourceProvider: input.sourceProvider || 'cache',
    sourceQuery: input.sourceQuery,
    raw: compactJson(input.raw),
  }
  const policyFlags = getListingPolicyFlags({
    title: product.title,
    description: product.description,
    niche: product.sourceNiche,
  })
  if (hasBlockedListingPolicyFlag(policyFlags)) return null

  product.qualityScore = scoreProduct(product)
  return product
}

function rowToProduct(row: ProductSourceRow): SourceEngineProduct {
  const raw = row.raw || {}
  const amazonPrice = parseNumber(row.amazon_price)
  const ebayPrice = getRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
  const metrics = getListingMetrics(amazonPrice, ebayPrice, EBAY_DEFAULT_FEE_RATE)
  const product: SourceEngineProduct = {
    asin: row.asin,
    title: row.title,
    amazonPrice,
    ebayPrice,
    profit: metrics.profit,
    roi: metrics.roi,
    imageUrl: row.image_url || undefined,
    risk: getRisk(amazonPrice, metrics.roi),
    salesVolume: row.sales_volume || undefined,
    images: Array.isArray(raw.images) ? raw.images as string[] : undefined,
    features: Array.isArray(raw.features) ? raw.features as string[] : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    specs: Array.isArray(raw.specs) ? raw.specs as Array<[string, string]> : undefined,
    sourceNiche: row.source_niche || undefined,
    _rating: parseNumber(row.rating),
    _numRatings: Math.round(parseNumber(row.review_count)),
  }
  product.qualityScore = scoreProduct(product)
  return product
}

export async function ensureProductSourceTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS product_source_items (
      asin TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_niche TEXT,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      source_query TEXT,
      amazon_price NUMERIC(10,2) NOT NULL,
      ebay_price NUMERIC(10,2) NOT NULL,
      profit NUMERIC(10,2) NOT NULL,
      roi NUMERIC(8,2) NOT NULL,
      image_url TEXT,
      risk TEXT NOT NULL DEFAULT 'MEDIUM',
      sales_volume TEXT,
      rating NUMERIC(3,2),
      review_count INTEGER,
      total_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_price_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS product_source_items_niche_score_idx ON product_source_items (source_niche, total_score DESC)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS product_source_items_score_idx ON product_source_items (total_score DESC)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS product_source_items_seen_idx ON product_source_items (last_seen_at DESC)`.catch(() => {})
}

export async function upsertProductSourceItems(inputs: SourceProductInput[]) {
  const normalized = inputs
    .map(normalizeProduct)
    .filter((product): product is NonNullable<ReturnType<typeof normalizeProduct>> => Boolean(product))

  if (normalized.length === 0) return 0
  await ensureProductSourceTables()

  const uniqueProductsByAsin = new Map<string, NonNullable<ReturnType<typeof normalizeProduct>>>()
  for (const product of normalized) {
    const current = uniqueProductsByAsin.get(product.asin)
    if (!current || (product.qualityScore || 0) > (current.qualityScore || 0)) {
      uniqueProductsByAsin.set(product.asin, product)
    }
  }

  const uniqueProducts = Array.from(uniqueProductsByAsin.values())
  const rows = uniqueProducts.map((product) => ({
    asin: product.asin,
    title: product.title,
    source_niche: product.sourceNiche || null,
    source_provider: product.sourceProvider,
    source_query: product.sourceQuery || null,
    amazon_price: product.amazonPrice.toFixed(2),
    ebay_price: product.ebayPrice.toFixed(2),
    profit: product.profit.toFixed(2),
    roi: product.roi.toFixed(2),
    image_url: product.imageUrl || null,
    risk: product.risk,
    sales_volume: product.salesVolume || null,
    rating: product._rating || null,
    review_count: product._numRatings || null,
    total_score: product.qualityScore || 0,
    raw: {
      images: product.images || [],
      features: product.features || [],
      description: product.description || '',
      specs: product.specs || [],
      sourceQuery: product.sourceQuery || null,
      raw: product.raw,
    },
  }))

  const chunkSize = 500
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    await sql`
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS product(
          asin TEXT,
          title TEXT,
          source_niche TEXT,
          source_provider TEXT,
          source_query TEXT,
          amazon_price NUMERIC,
          ebay_price NUMERIC,
          profit NUMERIC,
          roi NUMERIC,
          image_url TEXT,
          risk TEXT,
          sales_volume TEXT,
          rating NUMERIC,
          review_count INTEGER,
          total_score NUMERIC,
          raw JSONB
        )
      )
      INSERT INTO product_source_items (
        asin, title, source_niche, source_provider, source_query, amazon_price, ebay_price,
        profit, roi, image_url, risk, sales_volume, rating, review_count, total_score, raw
      )
      SELECT
        asin, title, source_niche, source_provider, source_query, amazon_price, ebay_price,
        profit, roi, image_url, risk, sales_volume, rating, review_count, total_score, raw
      FROM input
      ON CONFLICT (asin) DO UPDATE SET
        title = EXCLUDED.title,
        source_niche = COALESCE(EXCLUDED.source_niche, product_source_items.source_niche),
        source_provider = EXCLUDED.source_provider,
        source_query = COALESCE(EXCLUDED.source_query, product_source_items.source_query),
        amazon_price = EXCLUDED.amazon_price,
        ebay_price = EXCLUDED.ebay_price,
        profit = EXCLUDED.profit,
        roi = EXCLUDED.roi,
        image_url = COALESCE(EXCLUDED.image_url, product_source_items.image_url),
        risk = EXCLUDED.risk,
        sales_volume = COALESCE(EXCLUDED.sales_volume, product_source_items.sales_volume),
        rating = COALESCE(EXCLUDED.rating, product_source_items.rating),
        review_count = COALESCE(EXCLUDED.review_count, product_source_items.review_count),
        total_score = EXCLUDED.total_score,
        raw = product_source_items.raw || EXCLUDED.raw,
        active = TRUE,
        last_seen_at = NOW(),
        last_price_checked_at = NOW()
    `
  }

  return uniqueProducts.length
}

export async function rebuildProductSourceFromCache(limit = 250) {
  await ensureProductSourceTables()
  const rows = await queryRows<ProductCacheRow>`
    SELECT niche, results
    FROM product_cache
    WHERE niche <> '__continuous_listing__'
    ORDER BY cached_at DESC
    LIMIT ${limit}
  `
  const products: SourceProductInput[] = []
  for (const row of rows) {
    const rowProducts = Array.isArray(row.results) ? row.results : []
    for (const product of rowProducts) {
      products.push({
        ...product,
        sourceNiche: product.sourceNiche || row.niche,
        sourceProvider: 'cache',
      })
    }
  }
  return upsertProductSourceItems(products)
}

export async function repriceProductSourceItems(limit = 2500) {
  await ensureProductSourceTables()
  const rows = await queryRows<ProductSourceRow>`
    SELECT asin, title, source_niche, amazon_price, ebay_price, profit, roi, image_url, risk,
           sales_volume, rating, review_count, total_score, raw
    FROM product_source_items
    WHERE active = TRUE
    ORDER BY last_seen_at DESC
    LIMIT ${limit}
  `
  const products: SourceProductInput[] = rows.map((row) => {
    const raw = row.raw || {}
    return {
      asin: row.asin,
      title: row.title,
      amazonPrice: parseNumber(row.amazon_price),
      imageUrl: row.image_url || undefined,
      images: Array.isArray(raw.images) ? raw.images as string[] : undefined,
      features: Array.isArray(raw.features) ? raw.features as string[] : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      specs: Array.isArray(raw.specs) ? raw.specs as Array<[string, string]> : undefined,
      sourceNiche: row.source_niche || undefined,
      sourceProvider: 'repricer',
      raw,
      salesVolume: row.sales_volume || undefined,
      _rating: parseNumber(row.rating),
      _numRatings: Math.round(parseNumber(row.review_count)),
    }
  })
  return upsertProductSourceItems(products)
}

export async function refreshProductSourcePrices(options: { limit?: number; staleDays?: number } = {}) {
  await ensureProductSourceTables()
  const limit = Math.min(options.limit || 300, 500)
  const staleDays = options.staleDays || 5

  const rows = await queryRows<ProductSourceRow & { asin: string }>`
    SELECT asin, title, source_niche, amazon_price, ebay_price, profit, roi, image_url, risk,
           sales_volume, rating, review_count, total_score, raw
    FROM product_source_items
    WHERE active = TRUE
      AND last_seen_at < NOW() - INTERVAL '${staleDays} days'
    ORDER BY last_seen_at ASC
    LIMIT ${limit}
  `

  if (rows.length === 0) return { updated: 0, unchanged: 0, failed: 0 }

  const rapidKey = process.env.RAPIDAPI_KEY || ''
  let updated = 0, unchanged = 0, failed = 0
  const BATCH = 5

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await Promise.all(batch.map(async (row) => {
      try {
        let freshPrice: number | null = null

        if (rapidKey) {
          const res = await fetch(
            `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${row.asin}&country=US`,
            { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(6000) }
          ).catch(() => null)
          if (res?.ok) {
            const json = await res.json()
            const data = json?.data ?? json
            if (!String(data?.message || '').match(/limit|quota|exceed/)) {
              const raw = data.product_price || data.price
              const p = typeof raw === 'number' ? raw : parseFloat(String(raw || '').replace(/[^0-9.]/g, ''))
              if (p > 0) freshPrice = p
            }
          }
        }

        if (!freshPrice) return void (failed += 1)

        const oldPrice = parseNumber(row.amazon_price)
        // Only update if price changed by more than 2% to avoid noise
        if (Math.abs(freshPrice - oldPrice) / Math.max(oldPrice, 1) < 0.02) {
          unchanged += 1
          // Still touch last_seen_at so it doesn't keep getting re-checked
          await sql`UPDATE product_source_items SET last_seen_at = NOW() WHERE asin = ${row.asin}`.catch(() => {})
          return
        }

        // Price changed — recalculate eBay price using the live pricing engine
        const newEbayPrice = getRecommendedEbayPrice(freshPrice, EBAY_DEFAULT_FEE_RATE)
        const metrics = getListingMetrics(freshPrice, newEbayPrice, EBAY_DEFAULT_FEE_RATE)
        await sql`
          UPDATE product_source_items
          SET amazon_price = ${freshPrice},
              ebay_price   = ${newEbayPrice},
              profit       = ${metrics.profit},
              roi          = ${metrics.roi},
              last_seen_at = NOW()
          WHERE asin = ${row.asin}
        `.catch(() => {})
        updated += 1
      } catch {
        failed += 1
      }
    }))
  }

  return { updated, unchanged, failed }
}

export async function loadProductSourceProducts(options: { niche?: string | null; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(900, options.limit || 120))
  const rowLimit = Math.min(2500, Math.max(limit, limit * 3))
  try {
    const niche = options.niche?.trim()
    const rows = niche
      ? await queryRows<ProductSourceRow>`
          SELECT asin, title, source_niche, amazon_price, ebay_price, profit, roi, image_url, risk,
                 sales_volume, rating, review_count, total_score, raw
          FROM product_source_items
          WHERE active = TRUE
            AND source_niche = ${niche}
            AND last_seen_at > NOW() - INTERVAL '21 days'
          ORDER BY total_score DESC, last_seen_at DESC
          LIMIT ${rowLimit}
        `
      : await queryRows<ProductSourceRow>`
          SELECT asin, title, source_niche, amazon_price, ebay_price, profit, roi, image_url, risk,
                 sales_volume, rating, review_count, total_score, raw
          FROM product_source_items
          WHERE active = TRUE
            AND last_seen_at > NOW() - INTERVAL '21 days'
          ORDER BY total_score DESC, last_seen_at DESC
          LIMIT ${rowLimit}
        `
    return rows
      .map(rowToProduct)
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, limit)
  } catch {
    return []
  }
}
