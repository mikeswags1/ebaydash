import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows, sql } from '@/lib/db'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'

export const maxDuration = 300

// ── Shared helpers (mirrored from product-finder) ────────────────────────────
const EBAY_FEE = 0.15
const MIN_PROFIT = 6
const MAX_COST = 300
const CACHE_VERSION = 5
const SCHEDULED_NICHE_BATCH_SIZE = 8

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
  const targetProfit = amazonPrice < 15  ? 7
    : amazonPrice < 40  ? 12
    : amazonPrice < 100 ? 20
    : amazonPrice * 0.12
  const rawEbayPrice = (amazonPrice + targetProfit) / (1 - EBAY_FEE)
  const ebayPrice = Math.ceil(rawEbayPrice) - 0.01
  const fees   = parseFloat((ebayPrice * EBAY_FEE).toFixed(2))
  const profit = parseFloat((ebayPrice - amazonPrice - fees).toFixed(2))
  const roi    = parseFloat(((profit / amazonPrice) * 100).toFixed(0))
  return { ebayPrice, profit, roi }
}

function parsePrice(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function isRejected(title: string) {
  const t = title.toLowerCase()
  return REJECT_KEYWORDS.some(k => t.includes(k))
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

// ── Refresh one niche in the product_cache table ─────────────────────────────
async function refreshNiche(niche: string, rapidKey: string): Promise<number> {
  const queries = NICHE_QUERIES[niche] || [`${niche} bestseller`]
  const results: Record<string, unknown>[] = []
  const seen = new Set<string>()

  for (const query of queries.slice(0, 3)) {
    if (results.length >= 30) break
    try {
      const res = await fetch(
        `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(query)}&country=US&category_id=aps&page=1`,
        { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(8000) }
      )
      if (res.status === 429 || res.status === 403) return -1
      if (!res.ok) break
      const data = await res.json()
      if (String(data?.message || '').toLowerCase().match(/limit|quota|exceed/)) return -1
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
        results.push({ asin, title, amazonPrice: price, ebayPrice, profit, roi, imageUrl: String(p.product_photo || ''), risk, salesVolume: salesVol, _rating: rating, _numRatings: numRatings })
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
    await sql`INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(results)}, ${CACHE_VERSION})
              ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()`
  } catch { return 0 }
  return results.length
}

// ── Refresh one niche using direct Amazon scraping (no API key needed) ───────
async function refreshNicheScrape(niche: string): Promise<number> {
  const queries = (NICHE_QUERIES[niche] || [`${niche} bestseller`]).slice(0, 2)
  const results: Record<string, unknown>[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    if (results.length >= 30) break
    try {
      const scraped = await scrapeAmazonSearch(query)
      for (const p of scraped) {
        if (!p.asin || seen.has(p.asin)) continue
        seen.add(p.asin)
        if (!p.price || p.price <= 0 || p.price > MAX_COST || !p.title || isRejected(p.title)) continue
        const { ebayPrice, profit, roi } = calcMetrics(p.price)
        if (profit < MIN_PROFIT) continue
        const risk = p.price > 150 ? 'HIGH' : p.price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
        results.push({ asin: p.asin, title: p.title, amazonPrice: p.price, ebayPrice, profit, roi,
          imageUrl: p.imageUrl, risk, salesVolume: '', _rating: p.rating, _numRatings: p.reviewCount })
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
    await sql`INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(results)}, ${CACHE_VERSION})
              ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()`
  } catch { return 0 }
  return results.length
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

  const startedAt = Date.now()
  const report: Record<string, unknown> = {}
  const rollingRefresh = req.nextUrl.searchParams.get('rolling') === '1'
  const fullRefresh = req.nextUrl.searchParams.get('full') === '1' || !rollingRefresh
  const now = new Date()

  // 1. Sync eBay listing statuses for all users
  const shouldSyncUsers = fullRefresh || (now.getUTCMinutes() === 0 && now.getUTCHours() % 4 === 0)
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
  const batchSize = fullRefresh ? allNiches.length : SCHEDULED_NICHE_BATCH_SIZE
  const rotation = Math.floor(Date.now() / (15 * 60 * 1000))
  const startIndex = fullRefresh ? 0 : (rotation * batchSize) % allNiches.length
  const niches = Array.from({ length: Math.min(batchSize, allNiches.length) }, (_, index) => allNiches[(startIndex + index) % allNiches.length])
  let refreshed = 0, quotaHit = false

  if (rapidKey) {
    for (const niche of niches) {
      if (quotaHit || Date.now() - startedAt > 200_000) break
      const count = await refreshNiche(niche, rapidKey)
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
      if (Date.now() - startedAt > 270_000) break
      try {
        const count = await refreshNicheScrape(niche)
        if (count > 0) refreshed++
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 500))
    }
  }

  report.nichesRefreshed = refreshed
  report.nichesAttempted = niches
  report.quotaHit = quotaHit

  report.durationMs = Date.now() - startedAt
  return apiOk({ success: true, ...report })
}
