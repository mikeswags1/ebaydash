import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const EBAY_FEE = 0.1335
const MIN_PROFIT = 5
const MIN_ROI = 30
const MAX_COST = 300

const REJECT_KEYWORDS = [
  'rc plane','rc airplane','drone','laptop','tablet','ipad','iphone','macbook',
  'treadmill','elliptical','mattress','sofa','couch','generator','chainsaw',
  'television',' tv ','monitor','e-bike','pressure washer',
]

function calcMetrics(amazonPrice: number) {
  // Markup chosen so net margin stays ≥ 30% ROI after eBay fees
  const markup = amazonPrice < 15  ? 2.4
    : amazonPrice < 25  ? 2.1
    : amazonPrice < 40  ? 1.85
    : amazonPrice < 60  ? 1.65
    : amazonPrice < 100 ? 1.55
    : amazonPrice < 200 ? 1.45
    : 1.38
  const ebayPrice = parseFloat((amazonPrice * markup).toFixed(2))
  const fees = parseFloat((ebayPrice * EBAY_FEE).toFixed(2))
  const profit = parseFloat((ebayPrice - amazonPrice - fees).toFixed(2))
  const roi = parseFloat(((profit / amazonPrice) * 100).toFixed(0))
  return { ebayPrice, fees, profit, roi }
}

function isRejected(title: string) {
  const t = title.toLowerCase()
  return REJECT_KEYWORDS.some(k => t.includes(k))
}

const NICHE_QUERIES: Record<string, string[]> = {
  'Phone Accessories': ['phone case wireless charger', 'screen protector tempered glass phone'],
  'Computer Parts': ['usb c hub multiport adapter', 'laptop stand ergonomic adjustable'],
  'Audio & Headphones': ['wireless earbuds bluetooth', 'portable bluetooth speaker'],
  'Smart Home Devices': ['smart plug wifi outlet', 'smart home security camera indoor'],
  'Gaming Gear': ['gaming accessories rgb keyboard', 'gaming headset pc console'],
  'Kitchen Gadgets': ['kitchen gadgets silicone utensils', 'air fryer accessories baking'],
  'Home Decor': ['wall art prints framed bedroom', 'decorative vase home accent', 'throw blanket couch sofa', 'picture frames collage wall'],
  'Furniture & Lighting': ['led desk lamp usb charging', 'wall art canvas prints bedroom'],
  'Cleaning Supplies': ['cleaning supplies microfiber cloths', 'cleaning brush kit bathroom'],
  'Storage & Organization': ['storage bins organizer closet', 'cable management organizer desk'],
  'Camping & Hiking': ['camping lantern led rechargeable', 'tactical flashlight rechargeable'],
  'Garden & Tools': ['garden tools set planting', 'waterproof dry bag outdoor'],
  'Sporting Goods': ['resistance bands workout set', 'jump rope speed fitness'],
  'Fishing & Hunting': ['fishing lure kit bass trout', 'braided fishing line 30lb'],
  'Cycling': ['bike accessories cycling light', 'cycling gloves padded'],
  'Fitness Equipment': ['resistance bands set workout', 'ab roller wheel core'],
  'Personal Care': ['electric facial cleansing brush', 'facial roller jade gua sha'],
  'Supplements & Vitamins': ['turmeric curcumin black pepper capsules', 'magnesium glycinate sleep supplement', 'elderberry immune support gummies'],
  'Medical Supplies': ['pulse oximeter fingertip blood oxygen', 'digital thermometer forehead'],
  'Mental Wellness': ['essential oil diffuser ultrasonic', 'meditation cushion zafu'],
  'Car Parts': ['car accessories seat organizer', 'dash cam front rear camera'],
  'Car Accessories': ['magnetic phone mount car dashboard', 'car cleaning kit detailing'],
  'Motorcycle Gear': ['motorcycle gloves touchscreen riding', 'helmet visor sunshield'],
  'Truck & Towing': ['truck bed organizer storage', 'towing hitch cover ball'],
  'Car Care': ['car wash kit microfiber towels', 'windshield wiper blades universal'],
  'Pet Supplies': ['dog dental chews tartar control', 'cat interactive toys feather wand', 'pet deshedding brush dog cat'],
  'Baby & Kids': ['baby carrier wrap ergonomic', 'toddler activity toy learning'],
  'Toys & Games': ['fidget toys sensory pack', 'card games family fun'],
  'Clothing & Accessories': ['compression socks athletic women men', 'sun hat wide brim women'],
  'Jewelry & Watches': ['minimalist bracelet set women', 'watch band replacement silicone'],
  'Office Supplies': ['desk organizer accessories office', 'ergonomic wrist rest mouse pad'],
  'Industrial Equipment': ['safety glasses protective eyewear', 'work gloves mechanic heavy duty'],
  'Safety Gear': ['safety vest reflective high visibility', 'hard hat construction'],
  'Janitorial & Cleaning': ['heavy duty trash bags industrial', 'floor scrubber brush commercial'],
  'Packaging Materials': ['bubble mailers padded envelopes', 'shipping boxes packing tape'],
  'Trading Cards': ['card sleeves deck protector', 'card storage binder pokemon'],
  'Vintage & Antiques': ['vintage style wall clock decor', 'retro tin signs man cave'],
  'Coins & Currency': ['coin holder album collection', 'magnifying glass loupe jeweler'],
  'Comics & Manga': ['manga book storage box', 'comic book bags boards'],
  'Sports Memorabilia': ['sports card display case', 'autograph frame display'],
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const niche = req.nextUrl.searchParams.get('niche')
  if (!niche) return NextResponse.json({ error: 'Niche required' }, { status: 400 })

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return NextResponse.json({ error: 'RapidAPI key not configured' }, { status: 500 })

  const queries = NICHE_QUERIES[niche] || [`${niche} accessories bestseller`]
  const results: Array<{
    asin: string; title: string; amazonPrice: number; ebayPrice: number
    profit: number; roi: number; imageUrl?: string; risk: string
  }> = []

  const seenAsins = new Set<string>()

  for (const query of queries) {
    if (results.length >= 12) break
    try {
      // Step 1: search for ASINs
      const searchRes = await fetch(
        `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-search-by-keyword-asin?keyword=${encodeURIComponent(query)}&domainCode=com&sortBy=relevanceblender&numberOfProducts=20`,
        { headers: { 'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com', 'x-rapidapi-key': rapidKey } }
      )
      const searchData = await searchRes.json()
      // Axesso may return foundProducts or searchProductDetails[].asin
      let asins: string[] = searchData.foundProducts || []
      if (!asins.length && Array.isArray(searchData.searchProductDetails)) {
        asins = searchData.searchProductDetails.map((p: { asin?: string }) => p.asin).filter(Boolean)
      }
      if (!asins.length && Array.isArray(searchData.products)) {
        asins = searchData.products.map((p: { asin?: string }) => p.asin).filter(Boolean)
      }

      // Step 2: look up each ASIN until we get enough good results
      for (const asin of asins) {
        if (results.length >= 12) break
        if (seenAsins.has(asin)) continue
        seenAsins.add(asin)

        try {
          const lookupRes = await fetch(
            `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-lookup-product?url=https%3A%2F%2Fwww.amazon.com%2Fdp%2F${asin}`,
            { headers: { 'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com', 'x-rapidapi-key': rapidKey } }
          )
          const p = await lookupRes.json()
          if (p.type === 'error') continue

          const rawPrice = p.price ?? p.currentPrice ?? 0
          const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : rawPrice
          const title = p.productTitle ?? p.title ?? ''
          const imageUrl = p.imageUrl ?? p.mainImageUrl

          if (!price || price <= 0 || price > MAX_COST) continue
          if (!title || isRejected(title)) continue
          if (p.warehouseAvailability === 'NOT_AVAILABLE') continue

          const { ebayPrice, profit, roi } = calcMetrics(price)
          if (profit < MIN_PROFIT || roi < MIN_ROI) continue

          const risk = price > 150 ? 'HIGH' : price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
          results.push({ asin, title, amazonPrice: price, ebayPrice, profit, roi, imageUrl, risk })
        } catch { continue }
      }
    } catch { continue }
  }

  results.sort((a, b) => b.profit - a.profit)
  return NextResponse.json({ niche, results, count: results.length })
}
