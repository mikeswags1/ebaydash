import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows, sql } from '@/lib/db'
import { fetchAmazonProductByAsin } from '@/lib/amazon-product'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'

const EBAY_FEE   = 0.15   // 15% eBay take rate used in new pricing model
const MIN_PROFIT = 6
const MAX_COST   = 300
const CACHE_TTL  = 23 * 60 * 60 * 1000 // 23 hours — refresh once per day

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
  _rating?: number; _numRatings?: number
}

function calcMetrics(amazonPrice: number) {
  const targetProfit = amazonPrice < 15  ? 7
    : amazonPrice < 40  ? 12
    : amazonPrice < 100 ? 20
    : amazonPrice * 0.12
  const rawEbayPrice = (amazonPrice + targetProfit) / (1 - EBAY_FEE)
  // Round to nearest .99
  const ebayPrice = Math.ceil(rawEbayPrice) - 0.01
  const fees   = parseFloat((ebayPrice * EBAY_FEE).toFixed(2))
  const profit = parseFloat((ebayPrice - amazonPrice - fees).toFixed(2))
  const roi    = parseFloat(((profit / amazonPrice) * 100).toFixed(0))
  return { ebayPrice, fees, profit, roi }
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
      cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  } catch { /* already exists */ }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const niche = req.nextUrl.searchParams.get('niche')
  if (!niche) return apiError('Niche is required.', { status: 400, code: 'NICHE_REQUIRED' })

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  await ensureCacheTable()

  // ── Load user's already-listed ASINs (to filter duplicates) ─────────────────
  // Only block ASINs that are currently active on eBay (ended_at IS NULL)
  // If a listing sold out or was removed, that ASIN becomes available again
  let listedAsins = new Set<string>()
  try {
    await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`.catch(() => {})
    const listedRows = await queryRows<{ asin: string }>`SELECT asin FROM listed_asins WHERE user_id = ${session.user.id} AND ended_at IS NULL`
    listedAsins = new Set(listedRows.map((r) => String(r.asin)))
  } catch { /* table may not exist yet */ }

  // ── Check cache ──────────────────────────────────────────────────────────────
  let cacheRow: { results: Product[]; cached_at: Date } | null = null
  try {
    const rows = await queryRows<{ results: Product[]; cached_at: Date }>`SELECT results, cached_at FROM product_cache WHERE niche = ${niche}`
    if (rows[0]) cacheRow = rows[0] as { results: Product[]; cached_at: Date }
  } catch { /* ignore */ }

  const cacheAge = cacheRow ? Date.now() - new Date(cacheRow.cached_at).getTime() : Infinity
  const cacheIsFresh = cacheAge < CACHE_TTL

  if (cacheIsFresh && !forceRefresh) {
    // Serve from cache — filter out already-listed ASINs for this user
    const filtered = (cacheRow!.results as Product[]).filter(p => !listedAsins.has(p.asin))
    return apiOk({ niche, results: filtered, count: filtered.length, source: 'cache' })
  }

  // ── Fetch fresh data from API ────────────────────────────────────────────────
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    // No API key — fall back to cache if available
    if (cacheRow) {
      const filtered = (cacheRow.results as Product[]).filter(p => !listedAsins.has(p.asin))
      return apiOk({ niche, results: filtered, count: filtered.length, source: 'cache' })
    }
    return apiError('Product sourcing is not configured right now.', {
      status: 503,
      code: 'PRODUCT_SEARCH_NOT_CONFIGURED',
      details: { niche, results: [], count: 0 },
    })
  }

  const queries   = NICHE_QUERIES[niche] || [`${niche} bestseller`]
  const results: Product[] = []
  const seenAsins = new Set<string>()
  let apiQuotaExceeded = false

  const processProducts = (products: Record<string, unknown>[]) => {
    for (const p of products) {
      if (results.length >= 40) break
      const asin = String(p.asin || '')
      if (!asin || seenAsins.has(asin) || listedAsins.has(asin)) continue
      seenAsins.add(asin)
      const price       = parsePrice(p.product_price) || parsePrice(p.product_original_price)
      const title       = String(p.product_title || '')
      const imageUrl    = String(p.product_photo || '')
      const salesVolume = String(p.sales_volume || '')
      if (!price || price <= 0 || price > MAX_COST) continue
      if (!title || isRejected(title)) continue
      const { ebayPrice, profit, roi } = calcMetrics(price)
      if (profit < MIN_PROFIT) continue
      const risk = price > 150 ? 'HIGH' : price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
      results.push({ asin, title, amazonPrice: price, ebayPrice, profit, roi, imageUrl, risk, salesVolume,
        _rating: parseFloat(String(p.product_star_rating || '0')) || 0,
        _numRatings: parseInt(String(p.product_num_ratings || '0').replace(/[^0-9]/g, ''), 10) || 0,
      })
    }
  }

  for (const query of queries) {
    if (results.length >= 20 || apiQuotaExceeded) break
    for (const page of [1, 2]) {
      if (results.length >= 20) break
      try {
        const res = await fetch(
          `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(query)}&country=US&category_id=aps&page=${page}`,
          { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(10000) }
        )
        if (res.status === 429 || res.status === 403) { apiQuotaExceeded = true; break }
        const data = await res.json()
        if (String(data?.message || '').toLowerCase().match(/limit|quota|exceed/)) { apiQuotaExceeded = true; break }
        const products: Record<string, unknown>[] = data?.data?.products || []
        processProducts(products)
        if (products.length < 5) break
      } catch { continue }
    }
  }

  // ── Save fresh results to cache ──────────────────────────────────────────────
  if (results.length > 0) {
    results.sort((a, b) => {
      const score = (p: Product) => {
        const profitWeight  = p.profit
        const salesWeight   = Math.log10(parseSales(p.salesVolume) + 1)
        const ratingWeight  = p._rating  ? p._rating / 5  : 0.6
        const reviewWeight  = Math.log10((p._numRatings ?? 0) + 10)
        return profitWeight * salesWeight * ratingWeight * reviewWeight
      }
      return score(b) - score(a)
    })

    const enriched = await Promise.all(
      results.slice(0, 12).map(async (product) => {
        const validated = await fetchAmazonProductByAsin({
          asin: product.asin,
          fallbackImage: product.imageUrl,
          fallbackTitle: product.title,
          fallbackPrice: product.amazonPrice,
        }).catch(() => null)

        if (!validated) return product

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

    results.splice(0, enriched.length, ...enriched)

    try {
      await sql`
        INSERT INTO product_cache (niche, results) VALUES (${niche}, ${JSON.stringify(results)})
        ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, cached_at = NOW()
      `
    } catch { /* non-fatal */ }
  }

  // ── API failed — try direct Amazon scrape, then fall back to cache ──────────
  if (apiQuotaExceeded && results.length === 0) {
    if (cacheRow) {
      const filtered = (cacheRow.results as Product[]).filter(p => !listedAsins.has(p.asin))
      return apiOk({ niche, results: filtered, count: filtered.length, source: 'stale_cache' })
    }

    // No cache at all — scrape Amazon search directly (free, no quota)
    const scrapeQueries = (NICHE_QUERIES[niche] || [`${niche} bestseller`]).slice(0, 2)
    for (const query of scrapeQueries) {
      if (results.length >= 20) break
      try {
        const scraped = await scrapeAmazonSearch(query)
        for (const p of scraped) {
          if (results.length >= 20) break
          if (!p.asin || seenAsins.has(p.asin) || listedAsins.has(p.asin)) continue
          seenAsins.add(p.asin)
          if (!p.price || p.price <= 0 || p.price > MAX_COST) continue
          if (!p.title || isRejected(p.title)) continue
          const { ebayPrice, profit, roi } = calcMetrics(p.price)
          if (profit < MIN_PROFIT) continue
          const risk = p.price > 150 ? 'HIGH' : p.price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
          results.push({ asin: p.asin, title: p.title, amazonPrice: p.price, ebayPrice, profit, roi,
            imageUrl: p.imageUrl, risk, salesVolume: undefined, _rating: p.rating, _numRatings: p.reviewCount })
        }
      } catch { /* ignore */ }
    }

    if (results.length > 0) {
      results.sort((a, b) => {
        const score = (p: Product) =>
          p.profit * Math.log10(parseSales(p.salesVolume) + 1) *
          (p._rating ? p._rating / 5 : 0.6) * Math.log10((p._numRatings ?? 0) + 10)
        return score(b) - score(a)
      })
      try {
        await sql`INSERT INTO product_cache (niche, results) VALUES (${niche}, ${JSON.stringify(results)})
          ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, cached_at = NOW()`
      } catch { /* non-fatal */ }
      const filtered = results.filter(p => !listedAsins.has(p.asin))
      return apiOk({ niche, results: filtered, count: filtered.length, source: 'scrape' })
    }

    return apiError('Product search is temporarily unavailable. Try again in a few minutes.', {
      status: 503,
      code: 'PRODUCT_SEARCH_UNAVAILABLE',
      details: { niche, results: [], count: 0 },
    })
  }

  const filtered = results.filter(p => !listedAsins.has(p.asin))
  return apiOk({ niche, results: filtered, count: filtered.length, source: 'live' })
}
