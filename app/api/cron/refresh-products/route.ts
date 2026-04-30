import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows, sql } from '@/lib/db'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'
import { ensureProductSourceTables, rebuildProductSourceFromCache } from '@/lib/product-source-engine'
import { getListingPolicyFlags, hasBlockedListingPolicyFlag } from '@/lib/listing-policy'
import { EBAY_DEFAULT_FEE_RATE, getListingMetrics, getRecommendedEbayPrice } from '@/lib/listing-pricing'

export const maxDuration = 300

// ── Shared helpers (mirrored from product-finder) ────────────────────────────
const MIN_PROFIT = 6
const MAX_COST = 300
const CACHE_VERSION = 6
const CONTINUOUS_CACHE_KEY = '__continuous_listing__'
const MAX_CONTINUOUS_POOL_SIZE = 600
const STANDARD_NICHE_TARGET = 90
const CATALOG_NICHE_TARGET = 220
const SCHEDULED_NICHE_BATCH_SIZE = 8
const CATALOG_NICHE_BATCH_SIZE = 6

const REJECT_KEYWORDS = [
  'rc plane','rc airplane','drone','laptop','tablet','ipad','iphone','macbook',
  'treadmill','elliptical','mattress','sofa','couch','generator','chainsaw',
  'television',' tv ','monitor','e-bike','pressure washer',
  'louis vuitton','lv bag','gucci','chanel','prada','burberry','versace','fendi',
  'christian dior','yves saint laurent','hermes','hermès','balenciaga','givenchy',
  'rolex','omega watch','patek philippe','audemars piguet','hublot','cartier watch',
  'ray-ban','oakley sunglass','canada goose jacket','moncler jacket',
  'lego set','lego technic','lego duplo',
]

function calcMetrics(amazonPrice: number) {
  const ebayPrice = getRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
  const { profit, roi } = getListingMetrics(amazonPrice, ebayPrice, EBAY_DEFAULT_FEE_RATE)
  return { ebayPrice, profit, roi }
}

function parsePrice(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function repriceCachedProduct(product: Record<string, unknown>, sourceNiche: string) {
  const amazonPrice = parsePrice(product.amazonPrice)
  if (amazonPrice <= 0) return null
  const { ebayPrice, profit, roi } = calcMetrics(amazonPrice)
  const risk = amazonPrice > 150 ? 'HIGH' : amazonPrice > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
  return {
    ...product,
    amazonPrice,
    ebayPrice,
    profit,
    roi,
    risk,
    sourceNiche: product.sourceNiche || sourceNiche,
  }
}

function isRejected(title: string) {
  return hasBlockedListingPolicyFlag(getListingPolicyFlags({ title }))
}

const NICHE_QUERIES: Record<string, string[]> = {
  'Phone Accessories':      ['phone case wireless charger', 'screen protector tempered glass', 'phone stand holder desk', 'portable battery pack charger'],
  'Computer Parts':         ['usb c hub multiport adapter', 'laptop stand ergonomic adjustable', 'mechanical keyboard compact', 'wireless mouse ergonomic'],
  'Audio & Headphones':     ['wireless earbuds bluetooth noise cancelling', 'portable bluetooth speaker waterproof', 'headphone stand holder'],
  'Smart Home Devices':     ['smart plug wifi outlet alexa', 'smart home security camera indoor', 'smart led bulb color'],
  'Gaming Gear':            ['gaming accessories rgb keyboard', 'gaming headset pc ps4', 'gaming chair lumbar support'],
  'Kitchen Gadgets':        ['kitchen gadgets silicone utensils set', 'air fryer accessories baking', 'mandoline slicer vegetables'],
  'Home Decor':             ['wall art prints framed bedroom', 'decorative vase home accent', 'throw blanket couch soft', 'scented candle set home'],
  'Furniture & Lighting':   ['led desk lamp usb charging', 'floor lamp living room', 'wall sconce light plug in'],
  'Cleaning Supplies':      ['microfiber cleaning cloths pack', 'cleaning brush kit bathroom', 'squeegee window cleaner'],
  'Storage & Organization': ['storage bins organizer closet', 'cable management organizer desk', 'vacuum storage bags space saver'],
  'Camping & Hiking':       ['camping lantern led rechargeable', 'tactical flashlight rechargeable', 'hiking water bottle insulated'],
  'Garden & Tools':         ['garden tools set planting kit', 'pruning shears garden scissors', 'garden hose nozzle spray', 'garden gloves heavy duty'],
  'Sporting Goods':         ['resistance bands workout set', 'jump rope speed fitness', 'knee brace support sports'],
  'Fishing & Hunting':      ['fishing lure kit bass trout', 'braided fishing line 30lb', 'fishing tackle box organizer'],
  'Cycling':                ['bike accessories cycling light usb', 'cycling gloves padded gel', 'bike lock combination'],
  'Fitness Equipment':      ['resistance bands set workout loop', 'ab roller wheel core', 'foam roller muscle recovery'],
  'Personal Care':          ['electric facial cleansing brush', 'facial roller jade gua sha', 'hair turban towel microfiber'],
  'Supplements & Vitamins': ['vitamin d3 k2 supplement', 'magnesium glycinate sleep supplement', 'elderberry immune support gummies'],
  'Medical Supplies':       ['pulse oximeter fingertip blood oxygen', 'digital thermometer forehead'],
  'Mental Wellness':        ['essential oil diffuser ultrasonic', 'weighted sleep mask eye'],
  'Car Parts':              ['dash cam front rear camera', 'obd2 scanner bluetooth diagnostic', 'jump starter portable battery'],
  'Car Accessories':        ['car organizer back seat trunk', 'car cleaning kit detailing', 'air freshener vent clip'],
  'Motorcycle Gear':        ['motorcycle gloves touchscreen riding', 'motorcycle lock disc brake'],
  'Truck & Towing':         ['truck bed organizer storage', 'towing hitch receiver cover'],
  'Car Care':               ['car wash kit microfiber towels', 'windshield wiper blades universal'],
  'Pet Supplies':           ['dog dental chews tartar control', 'cat interactive toys feather wand', 'pet deshedding brush dog cat'],
  'Baby & Kids':            ['baby carrier wrap ergonomic newborn', 'toddler activity toy learning', 'silicone bib waterproof baby'],
  'Toys & Games':           ['fidget toys sensory pack kids', 'card games family fun adults', 'magnetic tiles building blocks'],
  'Clothing & Accessories': ['compression socks athletic women men', 'sun hat wide brim women upf'],
  'Jewelry & Watches':      ['minimalist bracelet set women gold', 'watch band replacement silicone'],
  'Office Supplies':        ['desk organizer accessories office', 'ergonomic wrist rest mouse pad'],
  'Industrial Equipment':   ['safety glasses protective eyewear ansi', 'work gloves mechanic heavy duty'],
  'Safety Gear':            ['safety vest reflective high visibility', 'first aid kit emergency'],
  'Janitorial & Cleaning':  ['heavy duty trash bags industrial 55 gallon', 'paper towels bulk pack'],
  'Packaging Materials':    ['bubble mailers padded envelopes', 'poly mailers shipping bags'],
  'Trading Cards':          ['card sleeves deck protector standard', 'card storage binder 9 pocket'],
  'Vintage & Antiques':     ['vintage style wall clock decor', 'retro tin signs man cave bar'],
  'Coins & Currency':       ['coin holder album collection', 'magnifying glass loupe jeweler'],
  'Comics & Manga':         ['manga book storage box', 'comic book bags boards supplies'],
  'Sports Memorabilia':     ['sports card display case frame', 'jersey display case shadow box'],
}

type RefreshOptions = {
  target?: number
  queryLimit?: number
  pages?: number[]
  timeoutMs?: number
}

function uniqueQueries(values: string[]) {
  const seen = new Set<string>()
  const queries: string[] = []

  for (const value of values) {
    const query = value.replace(/\s+/g, ' ').trim()
    const key = query.toLowerCase()
    if (!query || seen.has(key)) continue
    seen.add(key)
    queries.push(query)
  }

  return queries
}

function buildCatalogQueries(niche: string) {
  const baseQueries = NICHE_QUERIES[niche] || [`${niche} bestseller`]
  const nicheLower = niche.toLowerCase()
  const accessoriesQuery = nicheLower.includes('accessories') ? `${niche} kit` : `${niche} accessories`
  const categoryQueries = [
    `${niche} bestseller`,
    `${niche} best sellers`,
    `top rated ${niche}`,
    `popular ${niche}`,
    `trending ${niche}`,
    `high demand ${niche}`,
    `${niche} deals`,
    `${niche} under 25`,
    `${niche} under 50`,
    `${niche} bundle`,
    `${niche} pack`,
    `${niche} replacement`,
    `${niche} set`,
    `${niche} organizer`,
    `${niche} refill`,
    `${niche} parts`,
    `${niche} tools`,
    `${niche} small business`,
    accessoriesQuery,
  ]
  const modifierQueries = baseQueries.flatMap((query) => [
    query,
    `${query} best seller`,
    `${query} top rated`,
    `${query} pack`,
    `${query} replacement`,
  ])

  return uniqueQueries([...baseQueries, ...categoryQueries, ...modifierQueries])
}

// ── Refresh one niche in the product_cache table ─────────────────────────────
async function refreshNiche(niche: string, rapidKey: string, options: RefreshOptions = {}): Promise<number> {
  const target = Math.max(30, Math.min(CATALOG_NICHE_TARGET, options.target || STANDARD_NICHE_TARGET))
  const queries = buildCatalogQueries(niche).slice(0, options.queryLimit || 4)
  const pages = options.pages?.length ? options.pages : [1]
  const timeoutMs = options.timeoutMs || 8000
  const results: Record<string, unknown>[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    if (results.length >= target) break
    try {
      for (const page of pages) {
        if (results.length >= target) break
        const res = await fetch(
          `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(query)}&country=US&category_id=aps&page=${page}`,
          { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(timeoutMs) }
        )
        if (res.status === 429 || res.status === 403) return results.length > 0 ? results.length : -1
        if (!res.ok) break
        const data = await res.json()
        if (String(data?.message || '').toLowerCase().match(/limit|quota|exceed/)) return results.length > 0 ? results.length : -1
        const products: Record<string, unknown>[] = data?.data?.products || []

        for (const p of products) {
          const asin  = String(p.asin || '')
          if (!asin || seen.has(asin)) continue
          seen.add(asin)
          const price = parsePrice(p.product_price) || parsePrice(p.product_original_price)
          const title = String(p.product_title || '')
          if (!price || price <= 0 || price > MAX_COST || !title || isRejected(title)) continue
          const { ebayPrice, profit, roi } = calcMetrics(price)
          if (profit < MIN_PROFIT) continue
          const risk       = price > 150 ? 'HIGH' : price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
          const salesVol   = String(p.sales_volume || '')
          const rating     = parseFloat(String(p.product_star_rating || '0')) || 0
          const numRatings = parseInt(String(p.product_num_ratings || '0').replace(/[^0-9]/g, ''), 10) || 0
          results.push({ asin, title, amazonPrice: price, ebayPrice, profit, roi, imageUrl: String(p.product_photo || ''), risk, salesVolume: salesVol, sourceNiche: niche, _rating: rating, _numRatings: numRatings })
          if (results.length >= target) break
        }
        if (products.length === 0) break
      }
    } catch { continue }
  }

  if (results.length === 0) return 0
  results.sort((a, b) => {
    const s = (p: Record<string, unknown>) =>
      (p.profit as number) * Math.log10(Math.max(parseInt(String(p.salesVolume || '0').replace(/[^0-9]/g, ''), 10) || 1, 1) + 1)
        * ((p._rating as number || 3) / 5)
        * Math.log10((p._numRatings as number || 0) + 10)
    return s(b) - s(a)
  })

  try {
    await sql`INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(results.slice(0, target))}, ${CACHE_VERSION})
              ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()`
  } catch { return 0 }
  return results.length
}

// ── Refresh one niche using direct Amazon scraping (no API key needed) ───────
async function refreshNicheScrape(niche: string, options: RefreshOptions = {}): Promise<number> {
  const target = Math.max(30, Math.min(CATALOG_NICHE_TARGET, options.target || STANDARD_NICHE_TARGET))
  const queries = buildCatalogQueries(niche).slice(0, options.queryLimit || 3)
  const pages = options.pages?.length ? options.pages : [1]
  const timeoutMs = options.timeoutMs || 6000
  const results: Record<string, unknown>[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    if (results.length >= target) break
    try {
      for (const page of pages) {
        if (results.length >= target) break
        const scraped = await scrapeAmazonSearch(query, page, timeoutMs)
        for (const p of scraped) {
          if (!p.asin || seen.has(p.asin)) continue
          seen.add(p.asin)
          if (!p.price || p.price <= 0 || p.price > MAX_COST || !p.title || isRejected(p.title)) continue
          const { ebayPrice, profit, roi } = calcMetrics(p.price)
          if (profit < MIN_PROFIT) continue
          const risk = p.price > 150 ? 'HIGH' : p.price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
          results.push({ asin: p.asin, title: p.title, amazonPrice: p.price, ebayPrice, profit, roi,
            imageUrl: p.imageUrl, risk, salesVolume: '', sourceNiche: niche, _rating: p.rating, _numRatings: p.reviewCount })
          if (results.length >= target) break
        }
        if (scraped.length === 0) break
      }
    } catch { continue }
  }

  if (results.length === 0) return 0
  results.sort((a, b) => {
    const s = (p: Record<string, unknown>) =>
      (p.profit as number) * ((p._rating as number || 3) / 5) * Math.log10((p._numRatings as number || 0) + 10)
    return s(b) - s(a)
  })
  try {
    await sql`INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(results.slice(0, target))}, ${CACHE_VERSION})
              ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()`
  } catch { return 0 }
  return results.length
}

async function refreshContinuousCache(): Promise<number> {
  try {
    const rows = await queryRows<{ niche: string; results: Array<Record<string, unknown>> }>`
      SELECT niche, results
      FROM product_cache
      WHERE niche <> ${CONTINUOUS_CACHE_KEY}
      ORDER BY cached_at DESC
      LIMIT 120
    `
    const seen = new Set<string>()
    const products: Array<Record<string, unknown>> = []

    for (const row of rows) {
      const rowProducts = Array.isArray(row.results) ? row.results : []
      for (const product of rowProducts) {
        const asin = String(product.asin || '').toUpperCase()
        const title = String(product.title || '')
        if (!asin || seen.has(asin)) continue
        if (!title || isRejected(title)) continue
        seen.add(asin)
        const repriced = repriceCachedProduct({ ...product, asin }, row.niche)
        if (!repriced) continue
        products.push(repriced)
        if (products.length >= MAX_CONTINUOUS_POOL_SIZE) break
      }
      if (products.length >= MAX_CONTINUOUS_POOL_SIZE) break
    }

    if (products.length === 0) return 0
    products.sort((a, b) => {
      const score = (product: Record<string, unknown>) => {
        const profit = Number(product.profit) || 0
        const roi = Number(product.roi) || 0
        const rating = Number(product._rating) || 3.8
        const reviews = Number(product._numRatings) || 0
        return profit * Math.max(0.35, roi / 55) * Math.max(0.7, rating / 4.5) * Math.log10(reviews + 20)
      }
      return score(b) - score(a)
    })

    await sql`
      INSERT INTO product_cache (niche, results, version)
      VALUES (${CONTINUOUS_CACHE_KEY}, ${JSON.stringify(products)}, ${CACHE_VERSION})
      ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()
    `
    return products.length
  } catch {
    return 0
  }
}

// ── Sync one user's eBay listings — mark ended/sold listings in DB ────────────
async function syncUserListings(userId: number) {
  const credentials = await getValidEbayAccessToken(String(userId))
  if (!credentials?.accessToken) return
  const token = credentials.accessToken

  // Collect all active eBay listing IDs via GetMyeBaySelling (paginated)
  const activeIds = new Set<string>()
  let fetchSucceeded = false
  const appId = process.env.EBAY_APP_ID || ''
  for (let page = 1; page <= 20; page++) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList>
  <OutputSelector>ActiveList.ItemArray.Item.ItemID,ActiveList.PaginationResult.TotalNumberOfPages</OutputSelector>
</GetMyeBaySellingRequest>`
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: { 'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling', 'X-EBAY-API-SITEID': '0', 'X-EBAY-API-COMPATIBILITY-LEVEL': '967', 'X-EBAY-API-APP-NAME': appId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/xml' },
      body: xml,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return
    const text = await res.text()
    if (text.includes('<Ack>Failure</Ack>')) return
    fetchSucceeded = true
    const ids = [...text.matchAll(/<ItemID>(\d+)<\/ItemID>/g)].map(m => m[1])
    ids.forEach(id => activeIds.add(id))
    const totalPages = parseInt(text.match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/)?.[1] || '1', 10)
    if (page >= totalPages) break
  }

  if (!fetchSucceeded) return

  // Mark any listed ASIN whose eBay listing is no longer active
  const dbRows = await queryRows<{ id: number; ebay_listing_id: string }>`SELECT id, ebay_listing_id FROM listed_asins WHERE user_id = ${userId} AND ended_at IS NULL AND ebay_listing_id IS NOT NULL`
  const toEnd = dbRows.filter(r => !activeIds.has(String(r.ebay_listing_id)))
  if (toEnd.length > 0) {
    const ids = toEnd.map(r => r.id)
    await sql`UPDATE listed_asins SET ended_at = NOW() WHERE id = ANY(${ids})`
  }
}

// ── Cron handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  // Ensure ended_at column exists
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS product_cache (niche TEXT PRIMARY KEY, results JSONB NOT NULL, cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), version INTEGER NOT NULL DEFAULT 1)`.catch(() => {})
  await sql`ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`.catch(() => {})
  await ensureProductSourceTables().catch(() => {})

  const startedAt = Date.now()
  const report: Record<string, unknown> = {}
  const rollingRefresh = req.nextUrl.searchParams.get('rolling') === '1'
  const sourceOnly = req.nextUrl.searchParams.get('sourceOnly') === '1'
  const catalogRefresh = req.nextUrl.searchParams.get('catalog') === '1' || req.nextUrl.searchParams.get('deep') === '1'
  const fullRefresh = req.nextUrl.searchParams.get('full') === '1' || (!rollingRefresh && !catalogRefresh)
  const requestedBatchSize = Number(req.nextUrl.searchParams.get('batch') || '')
  const requestedStartIndex = Number(req.nextUrl.searchParams.get('start') || '')
  const now = new Date()

  if (sourceOnly) {
    report.sourceProducts = await rebuildProductSourceFromCache()
    report.continuousProducts = await refreshContinuousCache()
    report.durationMs = Date.now() - startedAt
    return apiOk({ success: true, ...report })
  }

  // 1. Sync eBay listing statuses for all users
  const shouldSyncUsers = !catalogRefresh && (fullRefresh || (now.getUTCMinutes() === 0 && now.getUTCHours() % 4 === 0))
  if (shouldSyncUsers) {
    try {
      const users = await queryRows<{ user_id: number }>`SELECT user_id FROM ebay_credentials`
      let synced = 0
      for (const u of users) {
        try { await syncUserListings(Number(u.user_id)); synced++ } catch { /* skip */ }
        if (Date.now() - startedAt > 120_000) break // stay within budget
      }
      report.usersSynced = synced
    } catch (e) { report.syncError = String(e) }
  } else {
    report.usersSynced = 'skipped'
  }

  // 2. Refresh product cache for all niches
  const rapidKey = process.env.RAPIDAPI_KEY
  const allNiches = Object.keys(NICHE_QUERIES)
  const targetProducts = catalogRefresh ? CATALOG_NICHE_TARGET : STANDARD_NICHE_TARGET
  const defaultBatchSize = catalogRefresh ? CATALOG_NICHE_BATCH_SIZE : (fullRefresh ? allNiches.length : SCHEDULED_NICHE_BATCH_SIZE)
  const batchSize = Math.max(1, Math.min(allNiches.length, Number.isFinite(requestedBatchSize) && requestedBatchSize > 0 ? Math.floor(requestedBatchSize) : defaultBatchSize))
  const rotationMinutes = catalogRefresh ? 60 : 15
  const rotation = Math.floor(Date.now() / (rotationMinutes * 60 * 1000))
  const startIndex = Number.isFinite(requestedStartIndex) && requestedStartIndex >= 0
    ? Math.floor(requestedStartIndex) % allNiches.length
    : fullRefresh && !catalogRefresh ? 0 : (rotation * batchSize) % allNiches.length
  const niches = Array.from({ length: Math.min(batchSize, allNiches.length) }, (_, index) => allNiches[(startIndex + index) % allNiches.length])
  const rapidOptions = catalogRefresh
    ? { target: targetProducts, queryLimit: 6, pages: [1, 2], timeoutMs: 4500 }
    : { target: targetProducts, queryLimit: 4, pages: [1], timeoutMs: 8000 }
  const scrapeOptions = catalogRefresh
    ? { target: targetProducts, queryLimit: 4, pages: [1, 2], timeoutMs: 3500 }
    : { target: targetProducts, queryLimit: 3, pages: [1], timeoutMs: 6000 }
  const runProductRefresh = async () => {
    let refreshed = 0
    let quotaHit = false

    if (rapidKey) {
      for (const niche of niches) {
        if (quotaHit || Date.now() - startedAt > (catalogRefresh ? 165_000 : 200_000)) break
        const count = await refreshNiche(niche, rapidKey, rapidOptions)
        if (count === -1) { quotaHit = true; break }
        if (count > 0) refreshed++
        await new Promise(r => setTimeout(r, 200))
      }
    } else {
      quotaHit = true // no key = treat same as quota hit
    }

    // If quota hit, fill remaining niches via direct Amazon scrape
    if (quotaHit) {
      for (const niche of niches) {
        if (Date.now() - startedAt > (catalogRefresh ? 235_000 : 270_000)) break
        try {
          const count = await refreshNicheScrape(niche, scrapeOptions)
          if (count > 0) refreshed++
        } catch { /* skip */ }
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return {
      nichesRefreshed: refreshed,
      nichesAttempted: niches,
      catalogRefresh,
      targetProductsPerNiche: targetProducts,
      batchSize,
      startIndex,
      quotaHit,
      sourceProducts: await rebuildProductSourceFromCache(catalogRefresh ? 250 : 120),
      continuousProducts: await refreshContinuousCache(),
    }
  }

  if (catalogRefresh && req.nextUrl.searchParams.get('wait') !== '1') {
    report.fastCatalogRefresh = true
    report.liveFetchSkipped = 'Add wait=1 to run the slower live Amazon fetch loop.'
    report.nichesRefreshed = 'skipped'
    report.nichesAttempted = niches
    report.catalogRefresh = catalogRefresh
    report.targetProductsPerNiche = targetProducts
    report.batchSize = batchSize
    report.startIndex = startIndex
    report.sourceProducts = await rebuildProductSourceFromCache(250)
    report.continuousProducts = await refreshContinuousCache()
    report.durationMs = Date.now() - startedAt
    return apiOk({ success: true, ...report })
  }

  Object.assign(report, await runProductRefresh())
  report.durationMs = Date.now() - startedAt
  return apiOk({ success: true, ...report })
}
