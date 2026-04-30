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

  const ebayPrice = input.ebayPrice && input.ebayPrice > 0
    ? parseNumber(input.ebayPrice)
    : getRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
  const metrics = getListingMetrics(amazonPrice, ebayPrice, EBAY_DEFAULT_FEE_RATE)
  const profit = input.profit !== undefined ? parseNumber(input.profit) : metrics.profit
  const roi = input.roi !== undefined ? parseNumber(input.roi) : metrics.roi
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
  return {
    asin: row.asin,
    title: row.title,
    amazonPrice: parseNumber(row.amazon_price),
    ebayPrice: parseNumber(row.ebay_price),
    profit: parseNumber(row.profit),
    roi: parseNumber(row.roi),
    imageUrl: row.image_url || undefined,
    risk: row.risk || 'MEDIUM',
    salesVolume: row.sales_volume || undefined,
    images: Array.isArray(raw.images) ? raw.images as string[] : undefined,
    features: Array.isArray(raw.features) ? raw.features as string[] : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    specs: Array.isArray(raw.specs) ? raw.specs as Array<[string, string]> : undefined,
    sourceNiche: row.source_niche || undefined,
    qualityScore: parseNumber(row.total_score),
    _rating: parseNumber(row.rating),
    _numRatings: Math.round(parseNumber(row.review_count)),
  }
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

  for (const product of normalized) {
    await sql`
      INSERT INTO product_source_items (
        asin, title, source_niche, source_provider, source_query, amazon_price, ebay_price,
        profit, roi, image_url, risk, sales_volume, rating, review_count, total_score, raw
      )
      VALUES (
        ${product.asin}, ${product.title}, ${product.sourceNiche || null}, ${product.sourceProvider}, ${product.sourceQuery || null},
        ${product.amazonPrice.toFixed(2)}, ${product.ebayPrice.toFixed(2)}, ${product.profit.toFixed(2)}, ${product.roi.toFixed(2)},
        ${product.imageUrl || null}, ${product.risk}, ${product.salesVolume || null}, ${product._rating || null},
        ${product._numRatings || null}, ${product.qualityScore || 0}, ${JSON.stringify({
          images: product.images || [],
          features: product.features || [],
          description: product.description || '',
          specs: product.specs || [],
          sourceQuery: product.sourceQuery || null,
          raw: product.raw,
        })}
      )
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

  return normalized.length
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

export async function loadProductSourceProducts(options: { niche?: string | null; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(900, options.limit || 120))
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
          LIMIT ${limit}
        `
      : await queryRows<ProductSourceRow>`
          SELECT asin, title, source_niche, amazon_price, ebay_price, profit, roi, image_url, risk,
                 sales_volume, rating, review_count, total_score, raw
          FROM product_source_items
          WHERE active = TRUE
            AND last_seen_at > NOW() - INTERVAL '21 days'
          ORDER BY total_score DESC, last_seen_at DESC
          LIMIT ${limit}
        `
    return rows.map(rowToProduct)
  } catch {
    return []
  }
}
