import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// Leaf category IDs verified for eBay US Trading API
const NICHE_CATEGORY: Record<string, string> = {
  'Phone Accessories':     '9394',   // Cell Phone Accessories
  'Computer Parts':        '58058',  // Keyboards, Mice & Pointing
  'Audio & Headphones':    '14985',  // Portable Stereos, Boomboxes
  'Smart Home Devices':    '183406', // Smart Plugs & Outlets
  'Gaming Gear':           '117042', // Controllers & Attachments
  'Kitchen Gadgets':       '20625',  // Kitchen Tools & Gadgets
  'Home Decor':            '10033',  // Home Décor
  'Furniture & Lighting':  '20697',  // Lamps, Lighting & Ceiling Fans
  'Cleaning Supplies':     '26677',  // Cleaning Supplies
  'Storage & Organization':'26677',  // Cleaning Supplies (storage adjacent)
  'Camping & Hiking':      '16034',  // Outdoor Sports
  'Garden & Tools':        '2032',   // Garden & Patio Tools
  'Sporting Goods':        '15273',  // Fitness Equipment
  'Fishing & Hunting':     '1492',   // Fishing
  'Cycling':               '7294',   // Cycling Accessories
  'Fitness Equipment':     '15273',  // Fitness Equipment
  'Personal Care':         '26248',  // Health Care
  'Supplements & Vitamins':'180960', // Herbal Supplements & Botanicals (leaf)
  'Medical Supplies':      '51148',  // Medical, Mobility & Disability
  'Mental Wellness':       '26395',  // Aromatherapy
  'Car Parts':             '6030',   // Car & Truck Parts
  'Car Accessories':       '14946',  // Car Electronics
  'Motorcycle Gear':       '10063',  // Motorcycle Accessories
  'Truck & Towing':        '6030',   // Car & Truck Parts
  'Car Care':              '179716', // Car Care
  'Pet Supplies':          '1281',   // Pet Supplies
  'Baby & Kids':           '2984',   // Baby
  'Toys & Games':          '19169',  // Board & Traditional Games
  'Clothing & Accessories':'11450',  // Clothing, Shoes & Accessories
  'Jewelry & Watches':     '137839', // Fashion Jewelry
  'Office Supplies':       '26215',  // Office & School Supplies
  'Industrial Equipment':  '12576',  // Business & Industrial
  'Safety Gear':           '177742', // Safety & Security
  'Janitorial & Cleaning': '26677',  // Cleaning Supplies
  'Packaging Materials':   '26677',  // Cleaning Supplies
  'Trading Cards':         '183050', // Trading Card Games
  'Vintage & Antiques':    '20081',  // Antiques
  'Coins & Currency':      '11116',  // Coins & Paper Money
  'Comics & Manga':        '259104', // Comics
  'Sports Memorabilia':    '64482',  // Sports Mem, Cards & Fan Shop
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

interface AmazonDetails {
  images: string[]
  features: string[]
  description: string
}

async function fetchAmazonDetails(asin: string, rapidKey: string, fallbackImage?: string): Promise<AmazonDetails> {
  try {
    const url = `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-lookup-product?url=https%3A%2F%2Fwww.amazon.com%2Fdp%2F${asin}`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })
    const data = await res.json()

    // All images — Axesso returns imageUrlList array
    const rawImages: string[] = (
      data.imageUrlList ?? data.imageList ?? data.images ?? []
    ).filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('http'))

    const mainImg: string = data.mainImageUrl ?? data.imageUrl ?? fallbackImage ?? ''
    const allImages = Array.from(new Set([mainImg, ...rawImages].filter(Boolean))).slice(0, 12)

    // Product feature bullets
    const rawFeatures: unknown[] = data.keyFeatures ?? data.featureBullets ?? data.features ?? data.bulletPoints ?? []
    const features = (rawFeatures as string[])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 5)
      .slice(0, 8)
      .map(f => f.replace(/[<>&"]/g, ' ').replace(/\s{2,}/g, ' ').trim())

    // Full Amazon product description
    const rawDesc: string = data.productDescription ?? data.description ?? data.productDetails ?? ''
    const description = rawDesc
      .replace(/<[^>]*>/g, ' ')   // strip any HTML tags
      .replace(/[<>&"]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 2000)

    return {
      images: allImages.length > 0 ? allImages : (fallbackImage ? [fallbackImage] : []),
      features,
      description,
    }
  } catch {
    return { images: fallbackImage ? [fallbackImage] : [], features: [], description: '' }
  }
}

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { asin, title, ebayPrice, imageUrl, niche } = await req.json()
  if (!asin || !title || !ebayPrice) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const token = await getFreshToken(session.user.id)
  if (!token) return NextResponse.json({ error: 'RECONNECT_REQUIRED' }, { status: 401 })

  const appId = process.env.EBAY_APP_ID || ''

  // Optimized title: strip non-ASCII/special chars, remove filler packaging phrases,
  // smart-truncate at word boundary to fit 80 chars
  const cleanTitle = title
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>&"]/g, '')
    .replace(/\s*[-|,]\s*(Pack of|Pack|Count|Piece|Pcs|Units?|Set of)\s*\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const safeTitle = cleanTitle.length <= 80
    ? cleanTitle
    : cleanTitle.slice(0, 80).replace(/\s+\S*$/, '').trim()

  const categoryId = NICHE_CATEGORY[niche] || '293'
  const price = parseFloat(ebayPrice).toFixed(2)
  const extraSpecifics = (NICHE_SPECIFICS[niche] || [])
    .map(([n, v]) => `\n      <NameValueList><Name>${n}</Name><Value>${v}</Value></NameValueList>`)
    .join('')

  // Fetch all Amazon images + feature bullets for this ASIN
  const rapidKey = process.env.RAPIDAPI_KEY || ''
  const amazon = await fetchAmazonDetails(asin, rapidKey, imageUrl)

  const productFeatures = amazon.features

  // Build product features section
  const featuresSection = productFeatures.length > 0
    ? `<div class="section"><div class="sec-label">&#128313; Product Features</div><ul class="feat-list">${productFeatures.map(f => `<li>${f}</li>`).join('')}</ul></div>`
    : ''

  // Amazon full description
  const aboutSection = amazon.description
    ? `<div class="section"><div class="sec-label">&#128196; About This Item</div><p class="desc-body">${amazon.description}</p></div>`
    : ''

  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;color:#222}.wrap{max-width:700px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}.hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:36px 40px 28px}.hero-eyebrow{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c8a250;margin-bottom:10px}.hero-title{font-size:22px;font-weight:800;color:#fff;line-height:1.4;max-width:580px}.badge-bar{display:flex;flex-wrap:wrap;gap:8px;padding:14px 40px;background:#0f172a;border-bottom:1px solid #1e2a40}.badge{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px}.badge-gold{background:rgba(200,162,80,.18);border:1px solid rgba(200,162,80,.4);color:#e0c875}.badge-green{background:rgba(22,163,74,.18);border:1px solid rgba(22,163,74,.45);color:#4ade80}.section{padding:28px 40px;border-bottom:1px solid #eaeaea}.sec-label{font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#999;margin-bottom:16px}.feat-list{list-style:none;display:flex;flex-direction:column;gap:10px}.feat-list li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#333;line-height:1.6;padding:10px 14px;background:#f9fafb;border-radius:8px;border-left:3px solid #2563eb}.feat-list li::before{content:"";display:none}.desc-body{font-size:14px;color:#444;line-height:1.8;padding:16px 20px;background:#f9fafb;border-radius:8px;border-left:3px solid #c8a250}.promise-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:28px 40px;border-bottom:1px solid #eaeaea}.promise-card{padding:20px 16px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center}.p-icon{font-size:28px;margin-bottom:8px}.p-title{font-size:13px;font-weight:700;color:#111;margin-bottom:3px}.p-sub{font-size:11px;color:#888}.deliver-banner{background:linear-gradient(90deg,#14532d,#166534);padding:18px 40px;display:flex;align-items:center;gap:14px}.d-icon{font-size:28px}.d-text{color:#fff}.d-head{font-size:15px;font-weight:800;letter-spacing:.5px}.d-sub{font-size:12px;color:#bbf7d0;margin-top:2px}.footer{background:#1a1a2e;padding:22px 40px;text-align:center;color:#777;font-size:12px;line-height:2}.footer strong{color:#c8a250}`

  const description = `<![CDATA[<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="wrap"><div class="hero"><div class="hero-eyebrow">Product Details</div><div class="hero-title">${safeTitle}</div></div><div class="badge-bar"><span class="badge badge-gold">&#10003; Brand New &amp; Sealed</span><span class="badge badge-green">&#128994; FREE 1&ndash;3 Day Delivery</span><span class="badge badge-gold">&#10003; Free Shipping</span><span class="badge badge-gold">&#10003; 30-Day Returns</span></div>${featuresSection}${aboutSection}<div class="deliver-banner"><div class="d-icon">&#128666;</div><div class="d-text"><div class="d-head">FREE 1&ndash;3 DAY DELIVERY</div><div class="d-sub">Order today &mdash; ships within 1 business day via USPS Priority Mail</div></div></div><div class="promise-grid"><div class="promise-card"><div class="p-icon">&#128230;</div><div class="p-title">Brand New &amp; Sealed</div><div class="p-sub">100% genuine, original packaging</div></div><div class="promise-card"><div class="p-icon">&#128666;</div><div class="p-title">Free Shipping</div><div class="p-sub">USPS Priority &mdash; no hidden fees</div></div><div class="promise-card"><div class="p-icon">&#8617;&#65039;</div><div class="p-title">30-Day Returns</div><div class="p-sub">Seller pays return shipping</div></div><div class="promise-card"><div class="p-icon">&#128272;</div><div class="p-title">Buyer Protection</div><div class="p-sub">100% satisfaction guaranteed</div></div></div><div class="footer">Questions? Message us &mdash; we respond within 24 hours<br><strong>&#9733; Add us to your Saved Sellers for new arrivals &amp; deals</strong></div></div></body></html>]]>`

  // Main image gets the "FREE SHIPPING · 1-3 DAY DELIVERY" banner burned in
  const host = req.headers.get('host') || ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const siteUrl = `${proto}://${host}`

  const allImages = amazon.images
  const badgedImages = allImages.map((u, i) =>
    i === 0 ? `${siteUrl}/api/image/badge?url=${encodeURIComponent(u)}` : u
  )

  const pictureXml = badgedImages.length > 0
    ? `<PictureDetails><GalleryType>Gallery</GalleryType>${badgedImages.map(u => `<PictureURL>${u}</PictureURL>`).join('')}</PictureDetails>`
    : ''

  const xmlParams = { token, safeTitle, description, categoryId, price, pictureXml, extraSpecifics }

  // First attempt with niche category
  let responseText = await submitToEbay(buildXml(xmlParams), token, appId)

  // Auto-retry with generic leaf category if eBay rejects as non-leaf
  const firstShort = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] || ''
  if (firstShort.toLowerCase().includes('leaf') || firstShort.toLowerCase().includes('not a valid category')) {
    responseText = await submitToEbay(buildXml({ ...xmlParams, categoryId: '293', extraSpecifics: '' }), token, appId)
  }

  const itemIdMatch = responseText.match(/<ItemID>(\d+)<\/ItemID>/)
  const shortMatch = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)
  const longMatch = responseText.match(/<LongMessage>(.*?)<\/LongMessage>/)
  const ackMatch = responseText.match(/<Ack>(.*?)<\/Ack>/)

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
