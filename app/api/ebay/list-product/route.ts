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

    const rawPhotos: unknown[] = (Array.isArray(data.product_photos) && data.product_photos.length > 0)
      ? data.product_photos
      : []
    const mainImg: string = (typeof rawPhotos[0] === 'string' ? rawPhotos[0] : null)
      ?? (typeof data.product_photo === 'string' ? data.product_photo : null)
      ?? fallbackImage ?? ''
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

    // Build features: from API → from specs → from generic fallback (Amazon API often returns empty data on free tier)
    let finalFeatures = features.length > 0
      ? features
      : specs.slice(0, 8).map(([k, v]) => `${k}: ${v}`)

    if (finalFeatures.length === 0) {
      finalFeatures = [
        'Brand new and factory sealed in original manufacturer packaging',
        'Premium quality — built to meet or exceed manufacturer specifications',
        'Simple setup, ready to use straight out of the box',
        'Compact, lightweight design — easy to store and carry',
        'Makes an excellent gift for any occasion',
        'Ships fast via USPS Priority Mail — arrives in 2-3 business days',
        '30-day hassle-free returns — your satisfaction is 100% guaranteed',
      ]
    }

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

// ── Description builder — matches Infinitybot style ─────────────────────────
function buildDescription(title: string, features: string[], _about: string, images: string[], specs: Array<[string, string]> = []): string {

  // Feature bullets — preserve 【bold label】 format from Amazon as-is
  const featureBullets = features.map(f => `<li>${f}</li>`).join('\n')

  // Inline product images — show ALL (including first) so even single-image products show something
  const inlineImgs = images.slice(0, 9)
  const imageBlock = inlineImgs.length > 0
    ? inlineImgs.map(u => `<img src="${u}" alt="" style="max-width:100%;display:block;margin:10px auto;">`).join('\n')
    : ''

  // Spec table rows
  const skipKeys = /customer|review|rating|star|bought|month|seller|return|warranty|asin|date first|best seller|discontinued|department|item model|upc|ean|isbn/i
  const specRows = specs
    .filter(([k]) => !skipKeys.test(k))
    .slice(0, 20)
    .map(([k, v]) => `<tr><td style="font-weight:bold;padding:6px 10px;width:35%;border-bottom:1px solid #ddd;">${k}</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${v}</td></tr>`)
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;">
<div style="max-width:750px;margin:0 auto;padding:0;">

  <!-- Title -->
  <h1 style="font-size:20px;font-weight:bold;padding:16px 12px 10px;margin:0;border-bottom:2px solid #eee;">${title}</h1>

  <!-- Features -->
  <div style="background:#666;color:#fff;text-align:center;padding:10px;font-size:16px;font-weight:bold;margin-top:16px;">Features</div>
  <ul style="font-size:14px;line-height:1.8;padding:14px 14px 14px 30px;margin:0;">
    ${featureBullets}
  </ul>

  <!-- Inline product images -->
  ${imageBlock ? `<div style="padding:10px 0;">${imageBlock}</div>` : ''}

  <!-- Specs table (if available) -->
  ${specRows ? `
  <div style="background:#666;color:#fff;text-align:center;padding:10px;font-size:16px;font-weight:bold;margin-top:16px;">Specifications</div>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tbody>${specRows}</tbody>
  </table>` : ''}

  <!-- Shipping -->
  <div style="background:#666;color:#fff;text-align:center;padding:10px;font-size:16px;font-weight:bold;margin-top:20px;">Shipping</div>
  <ul style="font-size:14px;line-height:1.9;padding:14px 14px 14px 30px;margin:0;">
    <li><strong>Free &amp; Fast Shipping:</strong> We offer free USPS Priority Mail shipping. Estimated delivery 2&ndash;4 business days.</li>
    <li><strong>Handling Time:</strong> Orders are processed and shipped within 1&ndash;2 business days of receiving cleared payment.</li>
    <li><strong>Order Tracking:</strong> A tracking number will be emailed to you as soon as your order ships.</li>
    <li><strong>State Restrictions:</strong> Shipping to Alaska, Hawaii, Puerto Rico, and other US territories may incur additional charges. Please contact us before ordering.</li>
  </ul>

  <!-- Return Policy -->
  <div style="background:#666;color:#fff;text-align:center;padding:10px;font-size:16px;font-weight:bold;margin-top:4px;">Return Policy</div>
  <ul style="font-size:14px;line-height:1.9;padding:14px 14px 14px 30px;margin:0;">
    <li><strong>30-Day Hassle-Free Returns:</strong> If you are not completely satisfied, return the item within 30 days for a full refund or exchange.</li>
    <li><strong>Easy Return Process:</strong> Contact us and we will provide a prepaid return shipping label and detailed instructions.</li>
    <li><strong>No Restocking Fee:</strong> We do not charge restocking fees for returns.</li>
    <li><strong>Refund Processing:</strong> Refunds are processed within 1 business day of receiving the returned item.</li>
  </ul>

  <!-- Feedback -->
  <div style="background:#666;color:#fff;text-align:center;padding:10px;font-size:16px;font-weight:bold;margin-top:4px;">Feedback</div>
  <p style="font-size:14px;line-height:1.8;padding:14px;margin:0;">
    Your feedback is extremely important to us. We strive to provide the best products and customer service possible.
    If you are satisfied with your purchase, please take a moment to leave us a positive review.
    If you have any concerns, please contact us <em>before</em> leaving negative feedback &mdash; we are committed to resolving any issue quickly.
  </p>

  <!-- Contact Us -->
  <div style="background:#666;color:#fff;text-align:center;padding:10px;font-size:16px;font-weight:bold;margin-top:4px;">Contact Us</div>
  <p style="font-size:14px;line-height:1.8;padding:14px;margin:0;">
    If you have any questions or concerns, please feel free to reach out through the eBay messaging system.
    We are available Monday to Friday, 9:00 am &ndash; 5:00 pm EST, and will respond to your inquiry within 24 hours.
  </p>

  <!-- Footer -->
  <p style="text-align:center;font-size:16px;font-weight:bold;padding:20px 12px;margin:0;border-top:2px solid #eee;">
    Thank you for supporting our small family business!
  </p>

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

  // Build proxied picture list FIRST — all images route through our server
  // so eBay can load them (Amazon CDN blocks eBay's crawlers directly).
  const host = req.headers.get('host') || ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const siteUrl = `${proto}://${host}`

  const allImages = amazon.images.length > 0
    ? amazon.images
    : (imageUrl ? [imageUrl] : [])

  const pictureList = allImages
    .filter(u => typeof u === 'string' && u.startsWith('http'))
    .slice(0, 12)
    .map((u, i) =>
      i === 0
        ? `${siteUrl}/api/image/badge?url=${encodeURIComponent(u)}`
        : `${siteUrl}/api/image/badge?stamp=0&url=${encodeURIComponent(u)}`
    )

  // Pass proxied URLs into description so inline images actually load on eBay
  const description = buildDescription(safeTitle, amazon.features, amazon.description, pictureList, amazon.specs)

  const xmlEncodeUrl = (u: string) => u.replace(/&/g, '&amp;').replace(/</g, '').replace(/>/g, '')
  const pictureXml = pictureList.length > 0
    ? `<PictureDetails><GalleryType>Gallery</GalleryType>${pictureList.map(u => `<PictureURL>${xmlEncodeUrl(u)}</PictureURL>`).join('')}</PictureDetails>`
    : ''

  const xmlParams = { token, safeTitle, description, categoryId, price, pictureXml, extraSpecifics }

  // Parse eBay response — skip deprecated warnings to surface real errors
  const notWarn = (s: string) => !s.toLowerCase().includes('deprecated')
  const parse = (r: string) => {
    const shorts = [...r.matchAll(/<ShortMessage>(.*?)<\/ShortMessage>/g)].map(m => m[1])
    const longs  = [...r.matchAll(/<LongMessage>(.*?)<\/LongMessage>/g)].map(m => m[1])
    const codes  = [...r.matchAll(/<ErrorCode>(.*?)<\/ErrorCode>/g)].map(m => m[1])
    return {
      short: shorts.find(notWarn) || shorts[0] || '',
      long:  longs.find(notWarn)  || longs[0]  || '',
      codes,
      longs,
    }
  }

  // Classify the dominant error type
  const errType = (short: string, long: string, codes: string[]) => {
    const t = (short + ' ' + long).toLowerCase()
    if (codes.includes('87') || t.includes('not a leaf') || t.includes('leaf category')) return 'leaf'
    if (t.includes('not valid') && t.includes('category')) return 'leaf'
    if (codes.includes('21919303') || (t.includes('item specific') && (t.includes('missing') || t.includes('required')))) return 'specific'
    return 'other'
  }

  // Extract every "item specific X is missing" from eBay's error response and build XML for them
  const autoSpecificsXml = (r: string): string => {
    const longs = [...r.matchAll(/<LongMessage>(.*?)<\/LongMessage>/g)].map(m => m[1])
    const seen = new Set<string>()
    return longs.flatMap(l => {
      const m = l.match(/item specific (.+?) is missing/i)
      if (!m) return []
      const name = m[1].trim()
      if (seen.has(name)) return []
      seen.add(name)
      // Use sensible defaults for common required fields
      const defaults: Record<string, string> = {
        'Type': 'See Description', 'Model': 'See Description', 'Color': 'See Description',
        'Connectivity': 'See Description', 'Compatible Brand': 'Universal',
        'Screen Size': 'See Description', 'Processor': 'See Description',
        'Storage Capacity': 'See Description', 'Operating System': 'See Description',
        'Sport': 'See Description', 'Department': 'Unisex Adults', 'Size': 'One Size',
        'Material': 'See Description', 'Style': 'See Description',
      }
      const val = defaults[name] ?? 'See Description'
      return [`\n      <NameValueList><Name>${name}</Name><Value>${val}</Value></NameValueList>`]
    }).join('')
  }

  // ── Retry chain ──────────────────────────────────────────────────────────────
  // Attempt 1: niche category + niche specifics
  let responseText = await submitToEbay(buildXml(xmlParams), appId, token)
  let p = parse(responseText)
  let et = errType(p.short, p.long, p.codes)

  // Attempt 2: same category + auto-extracted required specifics from error
  if (et === 'specific') {
    const auto = autoSpecificsXml(responseText)
    responseText = await submitToEbay(buildXml({ ...xmlParams, extraSpecifics: extraSpecifics + auto }), appId, token)
    p = parse(responseText)
    et = errType(p.short, p.long, p.codes)
    // Attempt 2b: only auto specifics (in case niche ones conflict)
    if (et === 'specific') {
      const auto2 = autoSpecificsXml(responseText)
      responseText = await submitToEbay(buildXml({ ...xmlParams, extraSpecifics: auto2 }), appId, token)
      p = parse(responseText)
      et = errType(p.short, p.long, p.codes)
    }
  }

  // Attempt 3: category 29223 (Everything Else > Everything Else — true leaf, no required specifics)
  if (et === 'leaf' || et === 'specific') {
    responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '29223', extraSpecifics: '' }), appId, token)
    p = parse(responseText)
    et = errType(p.short, p.long, p.codes)
  }

  // Attempt 4: category 45100 (Other Everything Else) as final resort
  if (et === 'leaf' || et === 'specific') {
    responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '45100', extraSpecifics: '' }), appId, token)
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
