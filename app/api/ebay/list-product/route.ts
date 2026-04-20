import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// ── VeRO Protection ──────────────────────────────────────────────────────────
const VERO_BRANDS = [
  'louis vuitton','lv bag','gucci','chanel','prada','burberry','versace','fendi',
  'christian dior','yves saint laurent','hermes','hermès','balenciaga','givenchy',
  'bottega veneta','celine','valentino','off-white','supreme box logo',
  'rolex','omega watch','patek philippe','audemars piguet','hublot','cartier watch',
  'breitling','tag heuer','iwc schaffhausen',
  'ray-ban','oakley sunglass',
  'canada goose jacket','moncler jacket','ugg boot',
  'lego set','lego technic','lego duplo',
]

function isVero(title: string): boolean {
  const t = title.toLowerCase()
  return VERO_BRANDS.some(b => t.includes(b))
}

// ── eBay Category IDs ────────────────────────────────────────────────────────
const NICHE_CATEGORY: Record<string, string> = {
  'Phone Accessories':     '9394',
  'Computer Parts':        '58058',
  'Audio & Headphones':    '14985',
  'Smart Home Devices':    '183406',
  'Gaming Gear':           '117042',
  'Kitchen Gadgets':       '20625',
  'Home Decor':            '10033',
  'Furniture & Lighting':  '95672',
  'Cleaning Supplies':     '26677',
  'Storage & Organization':'26677',
  'Camping & Hiking':      '16034',
  'Garden & Tools':        '2032',
  'Sporting Goods':        '15273',
  'Fishing & Hunting':     '1492',
  'Cycling':               '2904',   // Bicycle Accessories & Gear
  'Fitness Equipment':     '15273',
  'Personal Care':         '26248',
  'Supplements & Vitamins':'180960',
  'Medical Supplies':      '51148',
  'Mental Wellness':       '26395',
  'Car Parts':             '6030',
  'Car Accessories':       '14946',
  'Motorcycle Gear':       '10063',
  'Truck & Towing':        '6030',
  'Car Care':              '179716',
  'Pet Supplies':          '1281',
  'Baby & Kids':           '2984',
  'Toys & Games':          '19169',
  'Clothing & Accessories':'11450',
  'Jewelry & Watches':     '137839',
  'Office Supplies':       '26215',
  'Industrial Equipment':  '12576',
  'Safety Gear':           '177742',
  'Janitorial & Cleaning': '26677',
  'Packaging Materials':   '26677',
  'Trading Cards':         '183050',
  'Vintage & Antiques':    '20081',
  'Coins & Currency':      '11116',
  'Comics & Manga':        '259104',
  'Sports Memorabilia':    '64482',
}

const NICHE_SPECIFICS: Record<string, Array<[string, string]>> = {
  'Audio & Headphones':    [['Connectivity', 'Wireless'], ['Type', 'Bluetooth Speaker']],
  'Phone Accessories':     [['Compatible Brand', 'Universal'], ['Type', 'Phone Accessory']],
  'Computer Parts':        [['Interface', 'USB'], ['Type', 'Computer Accessory']],
  'Smart Home Devices':    [['Connectivity', 'Wi-Fi'], ['Type', 'Smart Home Device']],
  'Gaming Gear':           [['Compatible Platform', 'PC, PlayStation, Xbox, Nintendo Switch'], ['Type', 'Gaming Accessory']],
  'Kitchen Gadgets':       [['Material', 'See Description'], ['Type', 'Kitchen Gadget']],
  'Home Decor':            [['Theme', 'Modern'], ['Type', 'Home Décor Accent']],
  'Furniture & Lighting':  [['Type', 'Desk Lamp'], ['Power Source', 'Electric']],
  'Cleaning Supplies':     [['Type', 'Cleaning Kit'], ['Surface Recommendation', 'Universal']],
  'Storage & Organization':[['Type', 'Storage Bin'], ['Material', 'Plastic']],
  'Camping & Hiking':      [['Type', 'Outdoor Gear'], ['Activity', 'Camping, Hiking']],
  'Garden & Tools':        [['Type', 'Garden Tool'], ['Material', 'See Description']],
  'Sporting Goods':        [['Type', 'Sporting Goods'], ['Activity', 'Fitness']],
  'Fishing & Hunting':     [['Type', 'Fishing Gear'], ['Activity', 'Fishing']],
  'Cycling':               [['Type', 'Cycling Accessory'], ['Activity', 'Cycling']],
  'Fitness Equipment':     [['Type', 'Fitness Accessory'], ['Activity', 'Exercise & Fitness']],
  'Personal Care':         [['Type', 'Personal Care Device'], ['Power Source', 'Battery Operated']],
  'Supplements & Vitamins':[['Type', 'Dietary Supplement'], ['Form', 'Capsule']],
  'Medical Supplies':      [['Type', 'Medical Supply'], ['For', 'Adults']],
  'Mental Wellness':       [['Type', 'Wellness Accessory'], ['Scent', 'See Description']],
  'Car Parts':             [['Placement on Vehicle', 'Universal'], ['Type', 'Car Accessory']],
  'Car Accessories':       [['Placement on Vehicle', 'Universal'], ['Type', 'Car Accessory']],
  'Motorcycle Gear':       [['Type', 'Motorcycle Accessory'], ['Material', 'See Description']],
  'Truck & Towing':        [['Placement on Vehicle', 'Universal'], ['Type', 'Truck Accessory']],
  'Car Care':              [['Type', 'Car Care Kit'], ['Surface Recommendation', 'All Surfaces']],
  'Pet Supplies':          [['Animal Type', 'Dog, Cat'], ['Type', 'Pet Accessory']],
  'Baby & Kids':           [['Age Range', 'Toddler'], ['Type', 'Baby Accessory']],
  'Toys & Games':          [['Age Level', '3+'], ['Type', 'Game']],
  'Clothing & Accessories':[['Department', 'Unisex Adults'], ['Size Type', 'Regular']],
  'Jewelry & Watches':     [['Metal', 'See Description'], ['Type', 'Fashion Jewelry']],
  'Office Supplies':       [['Type', 'Office Accessory'], ['Material', 'See Description']],
  'Industrial Equipment':  [['Type', 'Safety Equipment'], ['Material', 'See Description']],
  'Safety Gear':           [['Type', 'Safety Gear'], ['Material', 'See Description']],
  'Janitorial & Cleaning': [['Type', 'Cleaning Supply'], ['Surface Recommendation', 'Universal']],
  'Packaging Materials':   [['Type', 'Packaging Supply'], ['Material', 'See Description']],
  'Trading Cards':         [['Card Condition', 'Near Mint or Better'], ['Type', 'Card Supplies']],
  'Vintage & Antiques':    [['Style', 'Vintage'], ['Type', 'Collectible']],
  'Coins & Currency':      [['Type', 'Coin Collecting Supply'], ['Material', 'See Description']],
  'Comics & Manga':        [['Type', 'Comic Storage'], ['Material', 'Plastic']],
  'Sports Memorabilia':    [['Type', 'Display Case'], ['Material', 'See Description']],
}

// ── Content helpers ──────────────────────────────────────────────────────────
interface AmazonDetails {
  images: string[]
  features: string[]
  description: string
  specs: Array<[string, string]>
}

function sanitizeContent(text: string): string {
  return text
    .replace(/\b(amazon\.?com?|amazon prime|prime\s+shipping|prime\s+eligible|prime\s+member|fulfilled\s+by\s+amazon|ships\s+from\s+amazon|sold\s+by\s+amazon|amazon\s+basics|amazon\s+brand|buy\s+on\s+amazon|visit\s+the\s+\S+\s+store|fba)\b/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>&"]/g, ' ')
    // Strip leading emoji that Amazon includes in bullet points
    .replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\s]+/u, '')
    // Strip control characters invalid in XML 1.0 (causes XML Parse error)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Breaks a long description into short readable paragraphs (max 2 sentences each)
function formatAbout(text: string): string {
  if (text.length < 30) return ''
  const sentences = text.match(/[^.!?]+[.!?]+["']?/g) || [text]
  const paras: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    const chunk = sentences.slice(i, i + 2).join(' ').trim()
    if (chunk.length > 15) paras.push(`<p>${chunk}</p>`)
  }
  return paras.length ? paras.join('\n      ') : `<p>${text}</p>`
}

async function fetchAmazonDetails(
  asin: string, rapidKey: string, fallbackImage?: string
): Promise<AmazonDetails> {
  try {
    const url = `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })
    const json = await res.json()
    const data = json?.data ?? json

    const rawPhotos: unknown[] = data.product_photos ?? []
    const mainImg: string = (rawPhotos[0] as string) ?? data.product_photo ?? fallbackImage ?? ''
    const allImages = Array.from(
      new Set([mainImg, ...(rawPhotos as string[])].filter((u): u is string => typeof u === 'string' && u.startsWith('http')))
    ).slice(0, 12)

    // Try every possible field name for bullet features — use || so empty arrays fall through
    const rawFeatures: unknown[] = (
      data.about_product ||
      data.feature_bullets ||
      data.bullet_points ||
      data.product_features ||
      data.highlights ||
      data.key_features ||
      []
    )
    const features = (Array.isArray(rawFeatures) ? rawFeatures as string[] : [])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 5)
      .map(f => sanitizeContent(f).slice(0, 500))
      .filter(f => f.length > 5)

    // Try every possible field name for long description — use || so empty strings fall through
    const rawDesc: string = (
      data.product_description || data.description || data.synopsis ||
      data.product_information || data.full_description || ''
    )
    const description = sanitizeContent(rawDesc).slice(0, 6000)

    // Merge product_overview + product_details, filter Amazon-only metadata
    const rawSpecs: Record<string, unknown> = {
      ...(data.product_overview ?? {}),
      ...(data.product_details ?? {}),
    }
    const skipKeys = /customer|review|rating|star|bought|month|seller|return|warranty|asin|date first|best seller|discontinued|department|item model|upc|ean|isbn/i
    const specs: Array<[string, string]> = Object.entries(rawSpecs)
      .filter(([k, v]) => k && v && String(v).length > 0 && !skipKeys.test(k))
      .slice(0, 30)
      .map(([k, v]) => [sanitizeContent(k).slice(0, 80), sanitizeContent(String(v)).slice(0, 200)])
      .filter(([k, v]) => k.length > 1 && v.length > 1) as Array<[string, string]>

    // If API returned no bullet features, build them from specs so there's always content
    const finalFeatures = features.length > 0
      ? features
      : specs.slice(0, 8).map(([k, v]) => `${k}: ${v}`)

    return {
      images: allImages.length > 0 ? allImages : (fallbackImage ? [fallbackImage] : []),
      features: finalFeatures,
      description,
      specs,
    }
  } catch {
    return { images: fallbackImage ? [fallbackImage] : [], features: [], description: '', specs: [] }
  }
}

// ── Description builder ──────────────────────────────────────────────────────
function buildDescription(title: string, features: string[], about: string, images: string[], specs: Array<[string, string]> = []): string {

  const featureItems = features.map(f =>
    `<li class="feat-item"><span class="feat-check">&#10003;</span><span>${f}</span></li>`
  ).join('\n')

  const featureSection = featureItems ? `
  <div class="section">
    <div class="section-title">What's Included &amp; Key Features</div>
    <ul class="feat-list">${featureItems}</ul>
  </div>` : ''

  const formattedAbout = formatAbout(about)
  const aboutSection = formattedAbout ? `
  <div class="section">
    <div class="section-title">About This Product</div>
    <div class="about-body">${formattedAbout}</div>
  </div>` : ''

  const specRows = specs.map(([k, v]) =>
    `<tr><td class="spec-key">${k}</td><td class="spec-val">${v}</td></tr>`
  ).join('\n')
  const specsSection = specRows ? `
  <div class="section">
    <div class="section-title">Product Details &amp; Specifications</div>
    <table class="spec-table"><tbody>${specRows}</tbody></table>
  </div>` : ''

  const galleryImgs = images.slice(0, 9)
  const imageGallery = galleryImgs.length > 1 ? `
  <div class="section">
    <div class="section-title">Product Images</div>
    <div class="img-grid">
      ${galleryImgs.map((u, i) => `<img src="${u}" alt="View ${i + 1}" class="product-img" loading="lazy">`).join('\n      ')}
    </div>
  </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#111}
.wrap{max-width:700px;margin:0 auto;background:#fff;border:1px solid #ddd}

/* Hero */
.hero{background:linear-gradient(135deg,#0f1628 0%,#1e3a5f 100%);padding:32px 36px 26px}
.hero-tag{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#f0a500;margin-bottom:8px}
.hero-title{font-size:22px;font-weight:800;color:#fff;line-height:1.4;margin-bottom:8px}
.hero-sub{font-size:12px;color:#9bb}

/* Delivery bar */
.dbar{background:#007600;padding:14px 36px;display:flex;align-items:center;gap:12px}
.dbar-icon{font-size:24px}
.dbar-head{font-size:14px;font-weight:700;color:#fff}
.dbar-sub{font-size:12px;color:#9de09d;margin-top:2px}

/* Badges */
.badges{display:flex;flex-wrap:wrap;gap:6px;padding:12px 36px;background:#111}
.badge{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}
.bg{background:rgba(240,165,0,.15);border:1px solid rgba(240,165,0,.4);color:#f0c040}
.bgg{background:rgba(0,150,0,.2);border:1px solid rgba(0,200,0,.4);color:#4cff4c}

/* Sections */
.section{padding:24px 36px;border-bottom:1px solid #e8e8e8}
.section-title{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:14px}

/* Features */
.feat-list{list-style:none;display:flex;flex-direction:column;gap:8px}
.feat-item{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;background:#f9f9f9;border-radius:6px;border-left:3px solid #007600;font-size:14px;line-height:1.6;color:#333}
.feat-check{color:#007600;font-size:15px;font-weight:700;flex-shrink:0;margin-top:1px}

/* About */
.about-body{font-size:14px;color:#333;line-height:1.8;padding:16px 20px;background:#fafafa;border-radius:6px;border-left:4px solid #f0a500}
.about-body p{margin:0 0 14px}
.about-body p:last-child{margin-bottom:0}

/* Specs */
.spec-table{width:100%;border-collapse:collapse}
.spec-key{font-size:13px;font-weight:700;color:#555;padding:9px 14px 9px 0;width:38%;vertical-align:top;border-bottom:1px solid #eee}
.spec-val{font-size:13px;color:#111;padding:9px 0;border-bottom:1px solid #eee;line-height:1.5}

/* Images */
.img-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.product-img{width:100%;aspect-ratio:1;object-fit:contain;background:#f9f9f9;border-radius:6px;border:1px solid #e5e5e5;padding:6px}

/* Why us */
.why-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.why-card{padding:14px;background:#f9f9f9;border-radius:8px;border:1px solid #e5e5e5}
.why-icon{font-size:22px;margin-bottom:6px}
.why-title{font-size:13px;font-weight:700;color:#111;margin-bottom:4px}
.why-sub{font-size:12px;color:#777;line-height:1.5}

/* Promise grid */
.pgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:20px 36px;border-bottom:1px solid #e8e8e8;background:#fafafa}
.pcard{padding:14px 10px;text-align:center}
.p-icon{font-size:26px;margin-bottom:6px}
.p-title{font-size:11px;font-weight:700;color:#111;margin-bottom:3px}
.p-sub{font-size:10px;color:#888;line-height:1.4}

/* Footer */
.footer{background:#111;padding:20px 36px;text-align:center;color:#666;font-size:12px;line-height:2}
.footer strong{color:#f0a500}
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    <div class="hero-tag">Premium Quality &bull; Brand New &bull; Fast Shipping</div>
    <div class="hero-title">${title}</div>
    <div class="hero-sub">Factory Sealed &nbsp;&middot;&nbsp; Free 2&ndash;3 Day Delivery &nbsp;&middot;&nbsp; 30-Day Free Returns</div>
  </div>

  <div class="dbar">
    <div class="dbar-icon">&#128666;</div>
    <div>
      <div class="dbar-head">FREE 2&ndash;3 DAY DELIVERY</div>
      <div class="dbar-sub">Ships same or next business day &bull; USPS Priority Mail &bull; Full tracking included</div>
    </div>
  </div>

  <div class="badges">
    <span class="badge bgg">&#10003; Free 2&ndash;3 Day Shipping</span>
    <span class="badge bg">&#10003; Brand New &amp; Sealed</span>
    <span class="badge bg">&#10003; 30-Day Free Returns</span>
    <span class="badge bg">&#10003; Order Tracking</span>
    <span class="badge bg">&#10003; Secure Checkout</span>
  </div>

  ${featureSection}
  ${aboutSection}
  ${specsSection}
  ${imageGallery}

  <div class="section">
    <div class="section-title">Why Buy From Us</div>
    <div class="why-grid">
      <div class="why-card">
        <div class="why-icon">&#9889;</div>
        <div class="why-title">Fast 2&ndash;3 Day Delivery</div>
        <div class="why-sub">Ships same or next business day via USPS Priority Mail. Arrives in 2&ndash;3 days.</div>
      </div>
      <div class="why-card">
        <div class="why-icon">&#128230;</div>
        <div class="why-title">100% Genuine &amp; New</div>
        <div class="why-sub">Brand new, factory sealed in original manufacturer packaging. Never opened.</div>
      </div>
      <div class="why-card">
        <div class="why-icon">&#8617;</div>
        <div class="why-title">Easy 30-Day Returns</div>
        <div class="why-sub">Not satisfied? Return within 30 days. We cover return shipping — no hassle.</div>
      </div>
      <div class="why-card">
        <div class="why-icon">&#128205;</div>
        <div class="why-title">Full Order Tracking</div>
        <div class="why-sub">Tracking number emailed at shipment. Monitor your delivery every step of the way.</div>
      </div>
    </div>
  </div>

  <div class="pgrid">
    <div class="pcard">
      <div class="p-icon">&#128230;</div>
      <div class="p-title">Brand New</div>
      <div class="p-sub">Factory sealed, original packaging</div>
    </div>
    <div class="pcard">
      <div class="p-icon">&#128666;</div>
      <div class="p-title">Free Shipping</div>
      <div class="p-sub">USPS Priority 2&ndash;3 days</div>
    </div>
    <div class="pcard">
      <div class="p-icon">&#8617;</div>
      <div class="p-title">30-Day Returns</div>
      <div class="p-sub">Free return shipping</div>
    </div>
    <div class="pcard">
      <div class="p-icon">&#9733;</div>
      <div class="p-title">Top Seller</div>
      <div class="p-sub">Trusted store</div>
    </div>
  </div>

  <div class="footer">
    Thank you for shopping with us &mdash; we appreciate your business!<br>
    Questions? Message us and we&rsquo;ll respond within hours.<br>
    <strong>Follow our store for new deals every week</strong>
  </div>

</div>
</body>
</html>`

  const safeHtml = html
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/]]>/g, ']] >')
  return `<![CDATA[${safeHtml}]]>`
}



// ── Auth helper ──────────────────────────────────────────────────────────────
async function getFreshToken(userId: string): Promise<string | null> {
  const rows = await sql`SELECT oauth_token, refresh_token, token_expires_at FROM ebay_credentials WHERE user_id = ${userId}`
  if (!rows[0]) return null
  const { oauth_token, refresh_token, token_expires_at } = rows[0]

  const expired = !token_expires_at || new Date(token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
  if (!expired) return oauth_token as string
  if (!refresh_token) return null

  try {
    const creds = Buffer.from(`${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`).toString('base64')
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token as string,
        scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account',
      }),
    })
    const data = await res.json()
    if (!data.access_token) return null
    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    await sql`UPDATE ebay_credentials SET oauth_token = ${data.access_token}, token_expires_at = ${expiresAt.toISOString()}, updated_at = NOW() WHERE user_id = ${userId}`
    return data.access_token as string
  } catch { return null }
}

// ── eBay API call ────────────────────────────────────────────────────────────
async function submitToEbay(xml: string, appId: string, token: string): Promise<string> {
  const res = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'AddFixedPriceItem',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-APP-NAME': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/xml',
    },
    body: xml,
  })
  return res.text()
}

function buildXml(params: {
  token: string; safeTitle: string; description: string; categoryId: string
  price: string; pictureXml: string; extraSpecifics: string
}) {
  return `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${params.token}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${params.safeTitle}</Title>
    <Description>${params.description}</Description>
    <PrimaryCategory><CategoryID>${params.categoryId}</CategoryID></PrimaryCategory>
    <StartPrice>${params.price}</StartPrice>
    <ConditionID>1000</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <Location>${(process.env.EBAY_ITEM_LOCATION || 'New Jersey, United States').replace(/&/g, '&amp;')}</Location>
    <PostalCode>${process.env.EBAY_POSTAL_CODE || '07001'}</PostalCode>
    <DispatchTimeMax>1</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>2</Quantity>
    ${params.pictureXml}
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
        <FreeShipping>true</FreeShipping>
        <ShippingServiceAdditionalCost>0.00</ShippingServiceAdditionalCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Seller</ShippingCostPaidByOption>
    </ReturnPolicy>
    <ItemSpecifics>
      <NameValueList><Name>Brand</Name><Value>Unbranded</Value></NameValueList>${params.extraSpecifics}
    </ItemSpecifics>
  </Item>
</AddFixedPriceItemRequest>`
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { asin, title, ebayPrice, imageUrl, niche } = await req.json()
  if (!asin || !title || !ebayPrice) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (isVero(title)) {
    return NextResponse.json(
      { error: 'This product cannot be listed — it contains a brand enrolled in eBay VeRO. Choose a different product.' },
      { status: 400 }
    )
  }

  const token = await getFreshToken(session.user.id)
  if (!token) return NextResponse.json({ error: 'RECONNECT_REQUIRED' }, { status: 401 })

  const appId = process.env.EBAY_APP_ID || ''

  const cleanTitle = title
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>"]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/\s*[-|,]\s*(Pack of|Pack|Count|Piece|Pcs|Units?|Set of)\s*\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const safeTitle = cleanTitle.length <= 80
    ? cleanTitle
    : cleanTitle.slice(0, 80).replace(/\s+\S*$/, '').trim()

  const categoryId = NICHE_CATEGORY[niche] || '177'
  const price = parseFloat(ebayPrice).toFixed(2)
  const extraSpecifics = (NICHE_SPECIFICS[niche] || [])
    .map(([n, v]) => `\n      <NameValueList><Name>${n}</Name><Value>${v}</Value></NameValueList>`)
    .join('')

  const rapidKey = process.env.RAPIDAPI_KEY || ''
  const amazon = await fetchAmazonDetails(asin, rapidKey, imageUrl)
  const description = buildDescription(safeTitle, amazon.features, amazon.description, amazon.images, amazon.specs)

  // Use badge proxy for first image (FREE SHIPPING stamp), raw Amazon URLs for the rest.
  // All URLs are self-hosted — mixing EPS and self-hosted is not allowed by eBay.
  const host = req.headers.get('host') || ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const siteUrl = `${proto}://${host}`

  const mainImage = amazon.images[0] || imageUrl || ''
  const restImages = amazon.images.slice(1)

  const firstPictureUrl = mainImage
    ? `${siteUrl}/api/image/badge?url=${encodeURIComponent(mainImage)}`
    : ''

  const pictureList = firstPictureUrl
    ? [firstPictureUrl, ...restImages]
    : restImages

  const xmlEncodeUrl = (u: string) => u.replace(/&/g, '&amp;').replace(/</g, '').replace(/>/g, '')
  const pictureXml = pictureList.length > 0
    ? `<PictureDetails><GalleryType>Gallery</GalleryType>${pictureList.map(u => `<PictureURL>${xmlEncodeUrl(u)}</PictureURL>`).join('')}</PictureDetails>`
    : ''

  const xmlParams = { token, safeTitle, description, categoryId, price, pictureXml, extraSpecifics }

  // Helper: classify eBay error type from Short+Long messages
  const errType = (short: string, long: string) => {
    const t = (short + ' ' + long).toLowerCase()
    if (t.includes('leaf') || t.includes('not a valid category') || t.includes('invalid category')) return 'leaf'
    if (t.includes('item specific') && (t.includes('missing') || t.includes('required') || t.includes('not valid'))) return 'specific'
    return 'other'
  }
  const parse = (r: string) => {
    const shorts = [...r.matchAll(/<ShortMessage>(.*?)<\/ShortMessage>/g)].map(m => m[1])
    const longs  = [...r.matchAll(/<LongMessage>(.*?)<\/LongMessage>/g)].map(m => m[1])
    const notWarn = (s: string) => !s.toLowerCase().includes('deprecated')
    return {
      short: shorts.find(notWarn) || shorts[0] || '',
      long:  longs.find(notWarn)  || longs[0]  || '',
    }
  }

  // Attempt 1: niche category + niche specifics
  let responseText = await submitToEbay(buildXml(xmlParams), appId, token)
  let { short: s1, long: l1 } = parse(responseText)
  let et = errType(s1, l1)

  // Attempt 2: same category, no specifics (fixes "item specific X missing/not valid")
  if (et === 'specific') {
    responseText = await submitToEbay(buildXml({ ...xmlParams, extraSpecifics: '' }), appId, token)
    const p = parse(responseText)
    et = errType(p.short, p.long)
  }

  // Attempt 3: fallback to category 177 (Everything Else) for leaf or unresolvable specific errors
  if (et === 'leaf' || et === 'specific') {
    responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '177', extraSpecifics: '' }), appId, token)
    const p2 = parse(responseText)
    et = errType(p2.short, p2.long)
    // Attempt 4: last resort category (262024 = eBay's current catch-all, replaces deprecated 10971)
    if (et === 'leaf' || et === 'specific') {
      responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '262024', extraSpecifics: '' }), appId, token)
    }
  }

  const itemIdMatch = responseText.match(/<ItemID>(\d+)<\/ItemID>/)
  const ackMatch    = responseText.match(/<Ack>(.*?)<\/Ack>/)

  if (!itemIdMatch || ackMatch?.[1] === 'Failure') {
    // Collect all messages, skip pure deprecation warnings to surface the real error
    const allLong  = [...responseText.matchAll(/<LongMessage>(.*?)<\/LongMessage>/g)].map(m => m[1])
    const allShort = [...responseText.matchAll(/<ShortMessage>(.*?)<\/ShortMessage>/g)].map(m => m[1])
    const isWarningOnly = (s: string) =>
      s.toLowerCase().includes('deprecated') || s.toLowerCase().includes('will be deprecated')
    const errMsg =
      allLong.find(m => !isWarningOnly(m)) ||
      allShort.find(m => !isWarningOnly(m)) ||
      allLong[0] || allShort[0] ||
      responseText.slice(0, 400)
    if (errMsg.toLowerCase().includes('expired') || errMsg.toLowerCase().includes('auth token')) {
      return NextResponse.json({ error: 'RECONNECT_REQUIRED' }, { status: 401 })
    }
    return NextResponse.json({ error: errMsg, _raw: responseText.slice(0, 1200) }, { status: 400 })
  }

  const listingId = itemIdMatch[1]

  await sql`
    INSERT INTO listed_asins (user_id, asin, title, ebay_listing_id)
    VALUES (${session.user.id}, ${asin}, ${title.slice(0, 200)}, ${listingId})
    ON CONFLICT (user_id, asin) DO UPDATE SET ebay_listing_id = ${listingId}, listed_at = NOW()
  `.catch(() => {})

  return NextResponse.json({
    success: true,
    listingId,
    listingUrl: `https://www.ebay.com/itm/${listingId}`,
  })
}
