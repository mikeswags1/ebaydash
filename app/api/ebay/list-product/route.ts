import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

const NICHE_CATEGORY: Record<string, string> = {
  'Phone Accessories': '9394',
  'Computer Parts': '175673',
  'Audio & Headphones': '112529',
  'Smart Home Devices': '175690',
  'Gaming Gear': '139971',
  'Kitchen Gadgets': '20625',
  'Home Decor': '10033',
  'Furniture & Lighting': '10033',
  'Cleaning Supplies': '26677',
  'Storage & Organization': '26677',
  'Camping & Hiking': '16034',
  'Garden & Tools': '2032',
  'Sporting Goods': '888',
  'Fishing & Hunting': '1492',
  'Cycling': '7294',
  'Fitness Equipment': '15273',
  'Personal Care': '26248',
  'Supplements & Vitamins': '180959',
  'Medical Supplies': '15032',
  'Mental Wellness': '26395',
  'Car Parts': '6030',
  'Car Accessories': '14946',
  'Motorcycle Gear': '10063',
  'Truck & Towing': '6030',
  'Car Care': '179716',
  'Pet Supplies': '1281',
  'Baby & Kids': '2984',
  'Toys & Games': '220',
  'Clothing & Accessories': '11450',
  'Jewelry & Watches': '281',
  'Office Supplies': '16034',
  'Industrial Equipment': '12576',
  'Safety Gear': '177742',
  'Janitorial & Cleaning': '26677',
  'Packaging Materials': '26677',
  'Trading Cards': '2536',
  'Vintage & Antiques': '20081',
  'Coins & Currency': '11116',
  'Comics & Manga': '259104',
  'Sports Memorabilia': '64482',
}

async function ebay(token: string, method: string, path: string, body?: object) {
  const res = await fetch(`https://api.ebay.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) } }
  catch { return { ok: res.ok, status: res.status, data: text } }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { asin, title, ebayPrice, imageUrl, niche } = await req.json()
  if (!asin || !title || !ebayPrice) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const rows = await sql`SELECT oauth_token FROM ebay_credentials WHERE user_id = ${session.user.id}`
  const token = rows[0]?.oauth_token
  if (!token) return NextResponse.json({ error: 'eBay not connected — go to Settings first' }, { status: 400 })

  // Get fulfillment, payment, return policies
  const [fpRes, ppRes, rpRes] = await Promise.all([
    ebay(token, 'GET', '/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US'),
    ebay(token, 'GET', '/sell/account/v1/payment_policy?marketplace_id=EBAY_US'),
    ebay(token, 'GET', '/sell/account/v1/return_policy?marketplace_id=EBAY_US'),
  ])

  const fulfillmentPolicyId = fpRes.data?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId
  const paymentPolicyId = ppRes.data?.paymentPolicies?.[0]?.paymentPolicyId
  const returnPolicyId = rpRes.data?.returnPolicies?.[0]?.returnPolicyId

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    return NextResponse.json({
      error: 'Missing eBay business policies. Go to Seller Hub → Shipping / Payment / Returns and create at least one policy for each.'
    }, { status: 400 })
  }

  const sku = `EBAYDASH-${asin}-${Date.now()}`
  const safeTitle = title.replace(/[^a-zA-Z0-9 \-&,.'()]/g, '').slice(0, 80).trim()
  const categoryId = NICHE_CATEGORY[niche] || '293'

  const description = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px">
  <h2 style="color:#333">${safeTitle}</h2>
  <p style="color:#555;line-height:1.7">Brand new condition. Ships fast from US warehouse. Satisfaction guaranteed — we stand behind every order.</p>
  <ul style="color:#555;line-height:1.9">
    <li>✓ New, unused condition</li>
    <li>✓ Fast US shipping</li>
    <li>✓ 30-day hassle-free returns</li>
    <li>✓ Responsive seller support</li>
  </ul>
</div>`.trim()

  // Create inventory item
  const invRes = await ebay(token, 'PUT', `/sell/inventory/v1/inventory_item/${sku}`, {
    availability: { shipToLocationAvailability: { quantity: 99 } },
    condition: 'NEW',
    product: {
      title: safeTitle,
      description,
      imageUrls: imageUrl ? [imageUrl] : [],
      aspects: {},
    },
  })

  if (!invRes.ok) {
    return NextResponse.json({ error: `Inventory error: ${JSON.stringify(invRes.data)?.slice(0, 200)}` }, { status: 400 })
  }

  // Create offer
  const offerRes = await ebay(token, 'POST', '/sell/inventory/v1/offer', {
    sku,
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    listingDescription: description,
    pricingSummary: { price: { currency: 'USD', value: parseFloat(ebayPrice).toFixed(2) } },
    categoryId,
    listingPolicies: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId },
    quantityLimitPerBuyer: 5,
    includeCatalogProductDetails: false,
  })

  if (!offerRes.ok || !offerRes.data?.offerId) {
    return NextResponse.json({ error: `Offer error: ${JSON.stringify(offerRes.data)?.slice(0, 300)}` }, { status: 400 })
  }

  const offerId = offerRes.data.offerId

  // Publish
  const pubRes = await ebay(token, 'POST', `/sell/inventory/v1/offer/${offerId}/publish`, {})

  if (!pubRes.ok || !pubRes.data?.listingId) {
    return NextResponse.json({ error: `Publish error: ${JSON.stringify(pubRes.data)?.slice(0, 300)}` }, { status: 400 })
  }

  const listingId = pubRes.data.listingId

  // Save ASIN so it never shows in product finder again
  await sql`
    INSERT INTO listed_asins (user_id, asin, title, ebay_listing_id)
    VALUES (${session.user.id}, ${asin}, ${title.slice(0, 200)}, ${listingId})
    ON CONFLICT (user_id, asin) DO UPDATE SET ebay_listing_id = ${listingId}, listed_at = NOW()
  `.catch(() => {})

  return NextResponse.json({
    success: true,
    listingId,
    listingUrl: `https://www.ebay.com/itm/${listingId}`,
    sku,
  })
}
