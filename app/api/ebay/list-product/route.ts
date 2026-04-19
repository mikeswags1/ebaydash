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
  'Cycling':               '7294',
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
}

function sanitizeContent(text: string): string {
  return text
    .replace(/\b(amazon\.?com?|amazon prime|prime\s+shipping|prime\s+eligible|prime\s+member|fulfilled\s+by\s+amazon|ships\s+from\s+amazon|sold\s+by\s+amazon|amazon\s+basics|amazon\s+brand|buy\s+on\s+amazon|visit\s+the\s+\S+\s+store|fba)\b/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>&"]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function fetchAmazonDetails(
  asin: string, rapidKey: string, fallbackImage?: string
): Promise<AmazonDetails> {
  try {
    const url = `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-lookup-product?url=https%3A%2F%2Fwww.amazon.com%2Fdp%2F${asin}`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })
    const data = await res.json()

    const rawImages: string[] = (
      data.imageUrlList ?? data.imageList ?? data.images ?? []
    ).filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('http'))

    const mainImg: string = data.mainImageUrl ?? data.imageUrl ?? fallbackImage ?? ''
    const allImages = Array.from(new Set([mainImg, ...rawImages].filter(Boolean))).slice(0, 12)

    const rawFeatures: unknown[] = data.keyFeatures ?? data.featureBullets ?? data.features ?? data.bulletPoints ?? []
    const features = (rawFeatures as string[])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 5)
      .slice(0, 10)
      .map(f => sanitizeContent(f).slice(0, 400))
      .filter(f => f.length > 5)

    const rawDesc: string = data.productDescription ?? data.description ?? data.productDetails ?? ''
    const description = sanitizeContent(rawDesc).slice(0, 3000)

    return {
      images: allImages.length > 0 ? allImages : (fallbackImage ? [fallbackImage] : []),
      features,
      description,
    }
  } catch {
    return { images: fallbackImage ? [fallbackImage] : [], features: [], description: '' }
  }
}

// ── Delivery date helpers ────────────────────────────────────────────────────
function addBusinessDays(date: Date, n: number): Date {
  const d = new Date(date)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Description builder ──────────────────────────────────────────────────────
function buildDescription(title: string, features: string[], about: string): string {
  const now = new Date()
  const shipDate = addBusinessDays(now, 1)
  const delivMin = fmtDate(addBusinessDays(shipDate, 2))
  const delivMax = fmtDate(addBusinessDays(shipDate, 3))

  const featureRows = features
    .map(f => `<tr><td class="check">&#10003;</td><td>${f}</td></tr>`)
    .join('\n          ')

  const featureSection = featureRows ? `
  <div class="section">
    <div class="section-title">Key Features &amp; Benefits</div>
    <table class="feat-table"><tbody>
      ${featureRows}
    </tbody></table>
  </div>` : ''

  const aboutSection = about.length > 30 ? `
  <div class="section">
    <div class="section-title">Product Description</div>
    <div class="about-body">${about}</div>
  </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f2f5;color:#222}
.wrap{max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 40px rgba(0,0,0,.13)}

/* Hero */
.hero{background:linear-gradient(140deg,#0f1628 0%,#1a2744 100%);padding:38px 42px 30px}
.hero-tag{font-size:10px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:#c8a250;margin-bottom:10px;opacity:.9}
.hero-title{font-size:21px;font-weight:800;color:#fff;line-height:1.42;margin-bottom:10px}
.hero-sub{font-size:12px;color:#94a3b8;letter-spacing:.4px}

/* Delivery bar */
.dbar{background:#15803d;padding:17px 42px;display:flex;align-items:center;gap:14px}
.dbar-icon{font-size:26px;flex-shrink:0}
.dbar-head{font-size:15px;font-weight:800;color:#fff;letter-spacing:.3px}
.dbar-eta{font-size:12px;color:#bbf7d0;margin-top:4px}
.dbar-eta strong{color:#fff}

/* Badges */
.badges{display:flex;flex-wrap:wrap;gap:8px;padding:14px 42px;background:#0f172a}
.badge{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.4px}
.bg{background:rgba(200,162,80,.15);border:1px solid rgba(200,162,80,.35);color:#e0c875}
.bgg{background:rgba(22,163,74,.18);border:1px solid rgba(34,197,94,.4);color:#4ade80}

/* Sections */
.section{padding:28px 42px;border-bottom:1px solid #eef0f3}
.section-title{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;margin-bottom:18px}

/* Feature table */
.feat-table{width:100%;border-collapse:separate;border-spacing:0 6px}
.feat-table td{vertical-align:top;font-size:14px;color:#2d3748;line-height:1.7}
.check{width:26px;padding:8px 4px;color:#16a34a;font-size:16px;font-weight:700}
.feat-table tr td:last-child{padding:9px 15px;background:#f8fafc;border-radius:8px}

/* About */
.about-body{font-size:14px;color:#444;line-height:1.85;padding:18px 22px;background:#f8fafc;border-radius:8px;border-left:4px solid #c8a250}

/* Why us */
.why-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.why-card{display:flex;align-items:flex-start;gap:10px;padding:14px;background:#f8fafc;border-radius:9px;border:1px solid #e8ecf0}
.why-icon{font-size:22px;flex-shrink:0;margin-top:1px}
.why-title{font-size:13px;font-weight:700;color:#111;margin-bottom:3px}
.why-sub{font-size:11px;color:#888;line-height:1.55}

/* Shipping table */
.ship-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f2f2f2}
.ship-row:last-child{border:none}
.ship-label{font-size:12px;font-weight:700;color:#666;min-width:110px;flex-shrink:0}
.ship-val{font-size:13px;color:#222}
.green{color:#15803d;font-weight:700}

/* Promise grid */
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:28px 42px;border-bottom:1px solid #eef0f3}
.pcard{padding:18px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e4e6ea;text-align:center}
.p-icon{font-size:28px;margin-bottom:8px}
.p-title{font-size:12px;font-weight:700;color:#111;margin-bottom:3px}
.p-sub{font-size:11px;color:#888;line-height:1.5}

/* Footer */
.footer{background:#0f1628;padding:22px 42px;text-align:center;color:#556;font-size:12px;line-height:2.1}
.footer strong{color:#c8a250}
.stars{color:#f59e0b;font-size:14px}
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    <div class="hero-tag">Premium Quality Product</div>
    <div class="hero-title">${title}</div>
    <div class="hero-sub">Brand New &amp; Factory Sealed &nbsp;&middot;&nbsp; Fast Shipping &nbsp;&middot;&nbsp; Free 30-Day Returns</div>
  </div>

  <div class="dbar">
    <div class="dbar-icon">&#128666;</div>
    <div>
      <div class="dbar-head">FREE 2&ndash;3 DAY DELIVERY INCLUDED</div>
      <div class="dbar-eta">Estimated arrival: <strong>${delivMin} &ndash; ${delivMax}</strong> &nbsp;&bull;&nbsp; Ships within 1 business day &bull; USPS Priority Mail</div>
    </div>
  </div>

  <div class="badges">
    <span class="badge bgg">&#10003; Free 2&ndash;3 Day Delivery</span>
    <span class="badge bg">&#10003; Brand New &amp; Sealed</span>
    <span class="badge bg">&#10003; Free Shipping</span>
    <span class="badge bg">&#10003; 30-Day Free Returns</span>
    <span class="badge bg">&#10003; Secure Purchase</span>
  </div>

  ${featureSection}
  ${aboutSection}

  <div class="section">
    <div class="section-title">Why Shop With Us</div>
    <div class="why-grid">
      <div class="why-card">
        <div class="why-icon">&#9889;</div>
        <div>
          <div class="why-title">Lightning-Fast Shipping</div>
          <div class="why-sub">Ships within 1 business day via USPS Priority Mail. Delivered in 2&ndash;3 days.</div>
        </div>
      </div>
      <div class="why-card">
        <div class="why-icon">&#128230;</div>
        <div>
          <div class="why-title">100% Genuine Product</div>
          <div class="why-sub">Every item is brand new, factory sealed, and arrives in original packaging.</div>
        </div>
      </div>
      <div class="why-card">
        <div class="why-icon">&#8617;</div>
        <div>
          <div class="why-title">Hassle-Free Returns</div>
          <div class="why-sub">Full 30-day return window. We cover return shipping — no questions asked.</div>
        </div>
      </div>
      <div class="why-card">
        <div class="why-icon">&#128205;</div>
        <div>
          <div class="why-title">Full Order Tracking</div>
          <div class="why-sub">Tracking number provided at shipment so you always know where your order is.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Shipping &amp; Delivery Details</div>
    <div class="ship-row">
      <div class="ship-label">Shipping Cost</div>
      <div class="ship-val green">FREE &mdash; Included at no extra charge</div>
    </div>
    <div class="ship-row">
      <div class="ship-label">Carrier</div>
      <div class="ship-val">USPS Priority Mail</div>
    </div>
    <div class="ship-row">
      <div class="ship-label">Dispatch Time</div>
      <div class="ship-val">Ships within 1 business day of cleared payment</div>
    </div>
    <div class="ship-row">
      <div class="ship-label">Est. Delivery</div>
      <div class="ship-val green">${delivMin} &ndash; ${delivMax}</div>
    </div>
    <div class="ship-row">
      <div class="ship-label">Returns</div>
      <div class="ship-val">Free 30-day returns &mdash; seller pays return shipping</div>
    </div>
  </div>

  <div class="pgrid">
    <div class="pcard">
      <div class="p-icon">&#128230;</div>
      <div class="p-title">Brand New &amp; Sealed</div>
      <div class="p-sub">100% genuine, original factory packaging</div>
    </div>
    <div class="pcard">
      <div class="p-icon">&#128666;</div>
      <div class="p-title">Free 2&ndash;3 Day Shipping</div>
      <div class="p-sub">USPS Priority Mail at zero extra cost</div>
    </div>
    <div class="pcard">
      <div class="p-icon">&#8617;</div>
      <div class="p-title">30-Day Returns</div>
      <div class="p-sub">Seller covers all return shipping costs</div>
    </div>
    <div class="pcard">
      <div class="p-icon">&#9733;</div>
      <div class="p-title">Trusted Seller</div>
      <div class="p-sub">Verified store &bull; Top-rated service</div>
    </div>
  </div>

  <div class="footer">
    <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &nbsp; Thank you for shopping with us &nbsp; <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><br>
    Have a question? Message us — we respond within 24 hours<br>
    <strong>&#128276; Save our store for exclusive deals and new arrivals</strong>
  </div>

</div>
</body>
</html>`

  return `<![CDATA[${html}]]>`
}

// ── eBay Picture Services — upload badge image so it's permanently hosted ────
async function uploadBadgedImage(
  badgeUrl: string, token: string, appId: string
): Promise<string | null> {
  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ExternalPictureURL>${badgeUrl}</ExternalPictureURL>
</UploadSiteHostedPicturesRequest>`

    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-APP-NAME': appId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/xml',
      },
      body: xml,
    })
    const text = await res.text()
    const match = text.match(/<FullURL>(.*?)<\/FullURL>/)
    return match?.[1] || null
  } catch {
    return null
  }
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
async function submitToEbay(xml: string, token: string, appId: string): Promise<string> {
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
    <Location>${process.env.EBAY_ITEM_LOCATION || 'New Jersey, United States'}</Location>
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
    .replace(/[<>&"]/g, '')
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
  const description = buildDescription(safeTitle, amazon.features, amazon.description)

  // Upload first image with FREE SHIPPING banner to eBay's picture hosting
  // so it's permanently cached on eBay CDN (no proxy URL in the live listing)
  const host = req.headers.get('host') || ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const siteUrl = `${proto}://${host}`

  const mainImage = amazon.images[0] || imageUrl || ''
  const restImages = amazon.images.slice(1)

  let firstPictureUrl = mainImage
  if (mainImage) {
    const badgeUrl = `${siteUrl}/api/image/badge?url=${encodeURIComponent(mainImage)}`
    const hostedUrl = await uploadBadgedImage(badgeUrl, token, appId)
    if (hostedUrl) firstPictureUrl = hostedUrl
  }

  const pictureList = firstPictureUrl
    ? [firstPictureUrl, ...restImages]
    : restImages

  const pictureXml = pictureList.length > 0
    ? `<PictureDetails><GalleryType>Gallery</GalleryType>${pictureList.map(u => `<PictureURL>${u}</PictureURL>`).join('')}</PictureDetails>`
    : ''

  const xmlParams = { token, safeTitle, description, categoryId, price, pictureXml, extraSpecifics }

  // Submit listing — 3-tier retry if category is not a leaf
  let responseText = await submitToEbay(buildXml(xmlParams), token, appId)

  const isLeafError = (t: string) => {
    const l = t.toLowerCase()
    return l.includes('leaf') || l.includes('not a valid category') || l.includes('invalid category')
  }

  const firstShort = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] || ''
  const firstLong  = responseText.match(/<LongMessage>(.*?)<\/LongMessage>/)?.[1] || ''
  if (isLeafError(firstShort) || isLeafError(firstLong)) {
    // Tier 2: "Everything Else > Other" — verified leaf in eBay US
    responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '177', extraSpecifics: '' }), token, appId)
    const s2 = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] || ''
    const l2 = responseText.match(/<LongMessage>(.*?)<\/LongMessage>/)?.[1] || ''
    if (isLeafError(s2) || isLeafError(l2)) {
      // Tier 3: "Collectibles > Other"
      responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '10971', extraSpecifics: '' }), token, appId)
    }
  }

  const itemIdMatch = responseText.match(/<ItemID>(\d+)<\/ItemID>/)
  const shortMatch  = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)
  const longMatch   = responseText.match(/<LongMessage>(.*?)<\/LongMessage>/)
  const ackMatch    = responseText.match(/<Ack>(.*?)<\/Ack>/)

  if (!itemIdMatch || ackMatch?.[1] === 'Failure') {
    const errMsg = longMatch?.[1] || shortMatch?.[1] || responseText.slice(0, 400)
    if (errMsg.toLowerCase().includes('expired') || errMsg.toLowerCase().includes('auth token')) {
      return NextResponse.json({ error: 'RECONNECT_REQUIRED' }, { status: 401 })
    }
    return NextResponse.json({ error: errMsg }, { status: 400 })
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
