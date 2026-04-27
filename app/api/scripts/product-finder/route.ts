import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows, sql } from '@/lib/db'
import { fetchAmazonProductByAsin } from '@/lib/amazon-product'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'
import { EBAY_DEFAULT_FEE_RATE, getListingMetrics, getRecommendedEbayPrice, isHealthyListing } from '@/lib/listing-pricing'

const MAX_COST   = 300
const CACHE_TTL  = 23 * 60 * 60 * 1000 // 23 hours — refresh once per day
const CACHE_VERSION = 4
const TARGET_STOCK = 30
const MAX_POOL_SIZE = 120
const CONTINUOUS_CACHE_KEY = '__continuous_listing__'
const CONTINUOUS_QUERY_LIMIT = 52

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

type Product = {
  asin: string; title: string; amazonPrice: number; ebayPrice: number
  profit: number; roi: number; imageUrl?: string; risk: string; salesVolume?: string
  images?: string[]; features?: string[]; description?: string; specs?: Array<[string, string]>
  sourceNiche?: string; qualityScore?: number
  _rating?: number; _numRatings?: number
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pack|set|piece|pcs|count|for|with|and|the|a|an|of|to|in)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTitleScore(sourceTitle: string, candidateTitle: string) {
  const sourceWords = new Set(normalizeTitle(sourceTitle).split(' ').filter(Boolean))
  const candidateWords = new Set(normalizeTitle(candidateTitle).split(' ').filter(Boolean))
  if (sourceWords.size === 0 || candidateWords.size === 0) return 0

  let overlap = 0
  for (const word of sourceWords) {
    if (candidateWords.has(word)) overlap += 1
  }

  return overlap / Math.max(sourceWords.size, candidateWords.size)
}

function canonicalizeImageKey(value?: string) {
  return String(value || '')
    .replace(/\?.*$/, '')
    .replace(/\._[^./]+(?=\.[a-z0-9]+$)/i, '')
    .toLowerCase()
}

function dedupeProducts(products: Product[]) {
  const kept: Product[] = []

  for (const product of products) {
    const productImageKey = canonicalizeImageKey(product.imageUrl)
    const duplicate = kept.find((existing) => {
      const titleScore = getTitleScore(existing.title, product.title)
      const sameImage = productImageKey && productImageKey === canonicalizeImageKey(existing.imageUrl)
      const closePrice = Math.abs(existing.amazonPrice - product.amazonPrice) <= 3
      return sameImage || (titleScore >= 0.72 && closePrice)
    })

    if (!duplicate) {
      kept.push(product)
      continue
    }

    const duplicateScore = getProductScore(duplicate)
    const productScore = getProductScore(product)

    if (productScore > duplicateScore) {
      const index = kept.indexOf(duplicate)
      kept[index] = product
    }
  }

  return kept
}

function calcMetrics(amazonPrice: number) {
  const ebayPrice = getRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
  const { fees, profit, roi, margin } = getListingMetrics(amazonPrice, ebayPrice, EBAY_DEFAULT_FEE_RATE)
  return { ebayPrice, fees, profit, roi, margin }
}

function isRejected(title: string) {
  const t = title.toLowerCase()
  return REJECT_KEYWORDS.some(k => t.includes(k))
}

function parsePrice(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

const parseSales = (v?: string) => {
  if (!v) return 1
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 1 : Math.max(1, n)
}

function shuffle<T>(values: T[]) {
  const arr = [...values]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function getProductScore(product: Product) {
  const sales = parseSales(product.salesVolume)
  const rating = product._rating && product._rating > 0 ? product._rating : 3.8
  const reviews = product._numRatings ?? 0
  const margin = product.ebayPrice > 0 ? product.profit / product.ebayPrice : 0
  const roi = product.roi / 100
  const demandWeight = Math.log10(sales + 10)
  const ratingWeight = Math.max(0.55, Math.min(1.08, rating / 4.6))
  const reviewWeight = Math.log10(reviews + 25)
  const marginWeight = Math.max(0.35, Math.min(1.5, margin * 3.5))
  const roiWeight = Math.max(0.35, Math.min(1.45, roi * 1.4))
  const priceSweetSpot = product.amazonPrice >= 12 && product.amazonPrice <= 120 ? 1.08 : product.amazonPrice > 180 ? 0.78 : 0.95
  const riskPenalty = product.risk === 'HIGH' ? 0.68 : product.risk === 'MEDIUM' ? 0.88 : 1
  const imageWeight = product.imageUrl ? 1 : 0.72
  const score = product.profit * demandWeight * ratingWeight * reviewWeight * marginWeight * roiWeight * priceSweetSpot * riskPenalty * imageWeight
  return Number.isFinite(score) ? parseFloat(score.toFixed(2)) : 0
}

function rankProducts(products: Product[], randomize = false) {
  const ranked = dedupeProducts(products)
    .map((product) => ({ ...product, qualityScore: getProductScore(product) }))
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))

  if (!randomize) return ranked

  const top = ranked.slice(0, Math.min(60, ranked.length))
  const rest = ranked.slice(top.length)
  return [...shuffle(top), ...rest]
}

const NICHE_QUERIES: Record<string, string[]> = {
  'Phone Accessories':      ['phone case wireless charger', 'screen protector tempered glass', 'phone stand holder desk', 'portable battery pack charger'],
  'Computer Parts':         ['usb c hub multiport adapter', 'laptop stand ergonomic adjustable', 'mechanical keyboard compact', 'wireless mouse ergonomic'],
  'Audio & Headphones':     ['wireless earbuds bluetooth noise cancelling', 'portable bluetooth speaker waterproof', 'headphone stand holder', 'aux cable audio'],
  'Smart Home Devices':     ['smart plug wifi outlet alexa', 'smart home security camera indoor', 'smart led bulb color', 'motion sensor alarm'],
  'Gaming Gear':            ['gaming accessories rgb keyboard', 'gaming headset pc ps4', 'gaming chair lumbar support', 'controller grip thumb caps'],
  'Kitchen Gadgets':        ['kitchen gadgets silicone utensils set', 'air fryer accessories baking', 'mandoline slicer vegetables', 'can opener electric automatic'],
  'Home Decor':             ['wall art prints framed bedroom', 'decorative vase home accent', 'throw blanket couch soft', 'scented candle set home'],
  'Furniture & Lighting':   ['led desk lamp usb charging', 'floor lamp living room', 'wall sconce light plug in', 'curtain rod adjustable'],
  'Cleaning Supplies':      ['microfiber cleaning cloths pack', 'cleaning brush kit bathroom', 'mop replacement head flat', 'squeegee window cleaner'],
  'Storage & Organization': ['storage bins organizer closet', 'cable management organizer desk', 'drawer divider organizer bamboo', 'vacuum storage bags space saver'],
  'Camping & Hiking':       ['camping lantern led rechargeable', 'tactical flashlight rechargeable', 'hiking water bottle insulated', 'fire starter emergency kit'],
  'Garden & Tools':         ['garden tools set planting kit', 'pruning shears garden scissors', 'garden hose nozzle spray', 'garden gloves heavy duty', 'kneeling pad gardening foam'],
  'Sporting Goods':         ['resistance bands workout set', 'jump rope speed fitness', 'knee brace support sports', 'wrist wraps gym weightlifting'],
  'Fishing & Hunting':      ['fishing lure kit bass trout', 'braided fishing line 30lb', 'fishing tackle box organizer', 'hunting game camera trail'],
  'Cycling':                ['bike accessories cycling light usb', 'cycling gloves padded gel', 'bike lock combination', 'handlebar grip ergonomic'],
  'Fitness Equipment':      ['resistance bands set workout loop', 'ab roller wheel core', 'foam roller muscle recovery', 'yoga mat non slip thick'],
  'Personal Care':          ['electric facial cleansing brush', 'facial roller jade gua sha', 'hair turban towel microfiber', 'cuticle pusher nail care kit'],
  'Supplements & Vitamins': ['vitamin d3 k2 supplement', 'magnesium glycinate sleep supplement', 'elderberry immune support gummies', 'collagen peptides powder unflavored'],
  'Medical Supplies':       ['pulse oximeter fingertip blood oxygen', 'digital thermometer forehead', 'blood pressure cuff wrist monitor', 'pill organizer weekly daily'],
  'Mental Wellness':        ['essential oil diffuser ultrasonic', 'meditation cushion zafu floor', 'weighted sleep mask eye', 'aromatherapy stress relief'],
  'Car Parts':              ['dash cam front rear camera', 'car phone mount magnetic vent', 'obd2 scanner bluetooth diagnostic', 'jump starter portable battery'],
  'Car Accessories':        ['car organizer back seat trunk', 'car cleaning kit detailing', 'air freshener vent clip', 'seat cover protector universal'],
  'Motorcycle Gear':        ['motorcycle gloves touchscreen riding', 'helmet bluetooth headset', 'motorcycle lock disc brake', 'balaclava face mask riding'],
  'Truck & Towing':         ['truck bed organizer storage', 'towing hitch receiver cover', 'truck tailgate pad cycling', 'bed liner mat rubber'],
  'Car Care':               ['car wash kit microfiber towels', 'windshield wiper blades universal', 'tire pressure gauge digital', 'clay bar detailing kit'],
  'Pet Supplies':           ['dog dental chews tartar control', 'cat interactive toys feather wand', 'pet deshedding brush dog cat', 'dog harness no pull adjustable'],
  'Baby & Kids':            ['baby carrier wrap ergonomic newborn', 'toddler activity toy learning', 'silicone bib waterproof baby', 'diaper bag backpack large'],
  'Toys & Games':           ['fidget toys sensory pack kids', 'card games family fun adults', 'magnetic tiles building blocks', 'kinetic sand moldable'],
  'Clothing & Accessories': ['compression socks athletic women men', 'sun hat wide brim women upf', 'cooling towel sports workout', 'travel wallet rfid blocking'],
  'Jewelry & Watches':      ['minimalist bracelet set women gold', 'watch band replacement silicone', 'jewelry organizer box travel', 'earring set hypoallergenic women'],
  'Office Supplies':        ['desk organizer accessories office', 'ergonomic wrist rest mouse pad', 'standing desk mat anti fatigue', 'label maker tape refill'],
  'Industrial Equipment':   ['safety glasses protective eyewear ansi', 'work gloves mechanic heavy duty', 'ear protection earmuffs noise', 'respirator mask n95 reusable'],
  'Safety Gear':            ['safety vest reflective high visibility', 'hard hat construction vented', 'first aid kit emergency', 'fire extinguisher home small'],
  'Janitorial & Cleaning':  ['heavy duty trash bags industrial 55 gallon', 'floor scrubber brush commercial', 'paper towels bulk pack', 'hand soap refill gallon'],
  'Packaging Materials':    ['bubble mailers padded envelopes', 'shipping boxes packing tape', 'poly mailers shipping bags', 'stretch wrap film clear'],
  'Trading Cards':          ['card sleeves deck protector standard', 'card storage binder 9 pocket', 'card grading sleeves hard case', 'booster box display case'],
  'Vintage & Antiques':     ['vintage style wall clock decor', 'retro tin signs man cave bar', 'antique map print framed', 'vintage record album storage'],
  'Coins & Currency':       ['coin holder album collection', 'magnifying glass loupe jeweler', 'coin tubes storage capsule', 'currency detector pen'],
  'Comics & Manga':         ['manga book storage box', 'comic book bags boards supplies', 'action figure display case', 'anime poster print framed'],
  'Sports Memorabilia':     ['sports card display case frame', 'autograph frame display signed', 'jersey display case shadow box', 'trading card storage box'],
}

async function ensureCacheTable() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS product_cache (
      niche      TEXT        PRIMARY KEY,
      results    JSONB       NOT NULL,
      cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version    INTEGER     NOT NULL DEFAULT 1
    )`
  } catch { /* already exists */ }
  await sql`ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`.catch(() => {})
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const mode = req.nextUrl.searchParams.get('mode')
  const continuousMode = mode === 'continuous'
  const requestedNiche = req.nextUrl.searchParams.get('niche')
  const niche = continuousMode ? CONTINUOUS_CACHE_KEY : requestedNiche
  const targetCount = Math.max(1, Math.min(60, Number(req.nextUrl.searchParams.get('limit') || TARGET_STOCK) || TARGET_STOCK))
  const excludeAsins = new Set(
    (req.nextUrl.searchParams.get('exclude') || '')
      .split(',')
      .map((asin) => asin.trim().toUpperCase())
      .filter(Boolean)
  )
  if (!niche) return apiError('Niche is required.', { status: 400, code: 'NICHE_REQUIRED' })

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  await ensureCacheTable()

  // ── Load user's already-listed ASINs (to filter duplicates) ─────────────────
  // Only block ASINs that are currently active on eBay (ended_at IS NULL)
  // If a listing sold out or was removed, that ASIN becomes available again
  let listedAsins = new Set<string>()
  let listedTitles: string[] = []
  try {
    await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`.catch(() => {})
    const listedRows = await queryRows<{ asin: string; title: string | null }>`SELECT asin, title FROM listed_asins WHERE user_id = ${session.user.id} AND ended_at IS NULL`
    listedAsins = new Set(listedRows.map((r) => String(r.asin).toUpperCase()))
    listedTitles = listedRows.map((r) => String(r.title || '')).filter(Boolean)
  } catch { /* table may not exist yet */ }

  const matchesActiveListing = (title: string) =>
    listedTitles.some((listedTitle) => getTitleScore(listedTitle, title) >= 0.82)

  const shouldBlockProduct = (product: Pick<Product, 'asin' | 'title'>) =>
    listedAsins.has(product.asin.toUpperCase()) || excludeAsins.has(product.asin.toUpperCase()) || matchesActiveListing(product.title)

  const getAvailableProducts = (products: Product[]) =>
    rankProducts(products.filter((product) => !shouldBlockProduct(product)), continuousMode)

  const respondWithProducts = (products: Product[], source: string) => {
    const ranked = getAvailableProducts(products)
    return apiOk({
      niche: continuousMode ? 'Continuous Listing' : niche,
      mode: continuousMode ? 'continuous' : 'niche',
      results: ranked.slice(0, targetCount),
      count: Math.min(ranked.length, targetCount),
      available: ranked.length,
      source,
    })
  }

  // ── Check cache ──────────────────────────────────────────────────────────────
  let cacheRow: { results: Product[]; cached_at: Date; version?: number } | null = null
  try {
    const rows = await queryRows<{ results: Product[]; cached_at: Date; version?: number }>`SELECT results, cached_at, version FROM product_cache WHERE niche = ${niche}`
    if (rows[0]) cacheRow = rows[0] as { results: Product[]; cached_at: Date; version?: number }
  } catch { /* ignore */ }

  const cacheAge = cacheRow ? Date.now() - new Date(cacheRow.cached_at).getTime() : Infinity
  const cacheIsFresh = cacheAge < CACHE_TTL && (cacheRow?.version || 1) === CACHE_VERSION

  if (cacheIsFresh && !forceRefresh) {
    // Serve from cache — filter out already-listed ASINs for this user
    const cachedAvailable = getAvailableProducts(cacheRow!.results as Product[])
    if (cachedAvailable.length >= targetCount) {
      return respondWithProducts(cachedAvailable, 'cache')
    }
  }

  // ── Fetch fresh data from API ────────────────────────────────────────────────
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    // No API key — fall back to cache if available
    if (cacheRow) {
      return respondWithProducts(cacheRow.results as Product[], 'cache')
    }
    return apiError('Product sourcing is not configured right now.', {
      status: 503,
      code: 'PRODUCT_SEARCH_NOT_CONFIGURED',
      details: { niche, results: [], count: 0 },
    })
  }

  const queryEntries = continuousMode
    ? shuffle(Object.entries(NICHE_QUERIES).flatMap(([sourceNiche, queries]) => queries.map((query) => ({ sourceNiche, query })))).slice(0, CONTINUOUS_QUERY_LIMIT)
    : [...(NICHE_QUERIES[niche] || [`${niche} bestseller`]), `${niche} bestseller`, `${niche} high demand`, `${niche} trending`]
        .map((query) => ({ sourceNiche: niche, query }))
  const results: Product[] = []
  const seenAsins = new Set<string>()
  let apiQuotaExceeded = false
  const apiPoolTarget = continuousMode ? MAX_POOL_SIZE : Math.min(MAX_POOL_SIZE, Math.max(targetCount * 3, targetCount + 24))
  const apiPages = continuousMode ? [1, 2, 3] : [1, 2]

  const processProducts = (products: Record<string, unknown>[]) => {
    for (const p of products) {
      if (results.length >= MAX_POOL_SIZE) break
      const asin = String(p.asin || '')
      const title       = String(p.product_title || '')
      if (!asin || seenAsins.has(asin) || shouldBlockProduct({ asin, title })) continue
      seenAsins.add(asin)
      const price       = parsePrice(p.product_price) || parsePrice(p.product_original_price)
      const imageUrl    = String(p.product_photo || '')
      const salesVolume = String(p.sales_volume || '')
      if (!price || price <= 0 || price > MAX_COST) continue
      if (!title || isRejected(title)) continue
      const { ebayPrice, profit, roi } = calcMetrics(price)
      if (!isHealthyListing(price, ebayPrice, EBAY_DEFAULT_FEE_RATE)) continue
      const rating = parseFloat(String(p.product_star_rating || '0')) || 0
      const reviewCount = parseInt(String(p.product_num_ratings || '0').replace(/[^0-9]/g, ''), 10) || 0
      if (rating > 0 && rating < 3.8) continue
      if (reviewCount > 0 && reviewCount < 12 && parseSales(salesVolume) < 20) continue
      const risk = price > 150 ? 'HIGH' : price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
      results.push({ asin, title, amazonPrice: price, ebayPrice, profit, roi, imageUrl, risk, salesVolume,
        sourceNiche: (p as Record<string, unknown>)._sourceNiche ? String((p as Record<string, unknown>)._sourceNiche) : undefined,
        _rating: rating,
        _numRatings: reviewCount,
      })
    }
  }

  const addScrapedProducts = async (entries: Array<{ query: string; sourceNiche: string }>, queryLimit: number) => {
    for (const { query, sourceNiche } of entries.slice(0, queryLimit)) {
      if (getAvailableProducts(results).length >= targetCount || results.length >= MAX_POOL_SIZE) break
      try {
        const scraped = await scrapeAmazonSearch(query)
        for (const p of scraped) {
          if (getAvailableProducts(results).length >= targetCount || results.length >= MAX_POOL_SIZE) break
          if (!p.asin || seenAsins.has(p.asin) || shouldBlockProduct({ asin: p.asin, title: p.title })) continue
          seenAsins.add(p.asin)
          if (!p.price || p.price <= 0 || p.price > MAX_COST) continue
          if (!p.title || isRejected(p.title)) continue
          const { ebayPrice, profit, roi } = calcMetrics(p.price)
          if (!isHealthyListing(p.price, ebayPrice, EBAY_DEFAULT_FEE_RATE)) continue
          const risk = p.price > 150 ? 'HIGH' : p.price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
          results.push({ asin: p.asin, title: p.title, amazonPrice: p.price, ebayPrice, profit, roi,
            imageUrl: p.imageUrl, risk, salesVolume: undefined, sourceNiche, _rating: p.rating, _numRatings: p.reviewCount })
        }
      } catch { /* ignore */ }
    }
  }

  const mergeCachedProducts = () => {
    if (!cacheRow) return
    const seen = new Set(results.map((product) => product.asin.toUpperCase()))
    const cached = (cacheRow.results as Product[]).filter((product) => {
      const asin = product.asin.toUpperCase()
      if (seen.has(asin)) return false
      seen.add(asin)
      return true
    })
    results.splice(0, results.length, ...rankProducts([...results, ...cached], continuousMode))
  }

  const saveResultsToCache = async () => {
    if (results.length === 0) return
    try {
      await sql`
        INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(rankProducts(results, continuousMode))}, ${CACHE_VERSION})
        ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()
      `
    } catch { /* non-fatal */ }
  }

  for (const { query, sourceNiche } of queryEntries) {
    if (results.length >= apiPoolTarget || apiQuotaExceeded) break
    for (const page of apiPages) {
      if (results.length >= apiPoolTarget) break
      try {
        const res = await fetch(
          `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(query)}&country=US&category_id=aps&page=${page}`,
          { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(10000) }
        )
        if (res.status === 429 || res.status === 403) { apiQuotaExceeded = true; break }
        const data = await res.json()
        if (String(data?.message || '').toLowerCase().match(/limit|quota|exceed/)) { apiQuotaExceeded = true; break }
        const products: Record<string, unknown>[] = (data?.data?.products || []).map((product: Record<string, unknown>) => ({ ...product, _sourceNiche: sourceNiche }))
        processProducts(products)
        if (products.length === 0) break
      } catch { continue }
    }
  }

  // ── Save fresh results to cache ──────────────────────────────────────────────
  if (results.length > 0) {
    results.splice(0, results.length, ...rankProducts(results, continuousMode))

    const enriched = await Promise.all(
      results.slice(0, targetCount).map(async (product) => {
        const validated = await fetchAmazonProductByAsin({
          asin: product.asin,
          fallbackImage: product.imageUrl,
          fallbackTitle: product.title,
          fallbackPrice: product.amazonPrice,
          strictAsin: true,
        }).catch(() => null)

        if (!validated) return product
        const titleScore = getTitleScore(product.title, validated.title)
        const sameBrand =
          product.title.split(/\s+/)[0]?.toLowerCase() &&
          validated.title.split(/\s+/)[0]?.toLowerCase() &&
          product.title.split(/\s+/)[0].toLowerCase() === validated.title.split(/\s+/)[0].toLowerCase()

        if (titleScore < 0.42 && !sameBrand) {
          return null
        }

        return {
          ...product,
          title: validated.title || product.title,
          amazonPrice: validated.amazonPrice || product.amazonPrice,
          imageUrl: validated.imageUrl || product.imageUrl,
          images: validated.images,
          features: validated.features,
          description: validated.description,
          specs: validated.specs,
        }
      })
    )

    const filteredEnriched = dedupeProducts(enriched.filter((product): product is Product => Boolean(product)))
    const droppedSourceAsins = new Set(
      results
        .slice(0, targetCount)
        .map((product) => product.asin)
        .filter((asin) => !filteredEnriched.some((product) => product.asin === asin))
    )
    const remainder = results.slice(targetCount).filter((product) => !droppedSourceAsins.has(product.asin))
    results.splice(0, results.length, ...rankProducts([...filteredEnriched, ...remainder], continuousMode))

    await saveResultsToCache()
  }

  // ── API failed — try direct Amazon scrape, then fall back to cache ──────────
  if (apiQuotaExceeded && results.length === 0) {
    mergeCachedProducts()

    // No cache at all — scrape Amazon search directly (free, no quota)
    await addScrapedProducts(queryEntries, continuousMode ? 24 : 6)

    if (results.length > 0) {
      results.splice(0, results.length, ...rankProducts(results, continuousMode))
      await saveResultsToCache()
      return respondWithProducts(results, 'scrape')
    }

    return apiError('Product search is temporarily unavailable. Try again in a few minutes.', {
      status: 503,
      code: 'PRODUCT_SEARCH_UNAVAILABLE',
      details: { niche, results: [], count: 0 },
    })
  }

  if (getAvailableProducts(results).length < targetCount) {
    mergeCachedProducts()
  }

  if (getAvailableProducts(results).length < targetCount) {
    await addScrapedProducts(queryEntries, continuousMode ? 24 : 6)
    results.splice(0, results.length, ...rankProducts(results, continuousMode))
    await saveResultsToCache()
  }

  return respondWithProducts(results, 'live')
}
