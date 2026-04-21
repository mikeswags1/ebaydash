import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// Refresh token logic (same pattern as list-product)
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
        scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory',
      }),
    })
    const data = await res.json()
    if (!data.access_token) return null
    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    await sql`UPDATE ebay_credentials SET oauth_token = ${data.access_token}, token_expires_at = ${expiresAt.toISOString()}, updated_at = NOW() WHERE user_id = ${userId}`
    return data.access_token as string
  } catch { return null }
}

// Fetch eBay listing title using GetItem Trading API
async function getEbayItemTitle(itemId: string, token: string, appId: string): Promise<string | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ItemReturnDescription</DetailLevel>
  <OutputSelector>Title,PictureDetails</OutputSelector>
</GetItemRequest>`

  const res = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'GetItem',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-APP-NAME': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/xml',
    },
    body: xml,
    signal: AbortSignal.timeout(8000),
  })
  const text = await res.text()
  const titleMatch = text.match(/<Title>(.*?)<\/Title>/)
  return titleMatch?.[1]?.trim() || null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const itemId = req.nextUrl.searchParams.get('itemId')?.trim()
  if (!itemId || !/^\d+$/.test(itemId)) {
    return NextResponse.json({ error: 'Invalid eBay item ID' }, { status: 400 })
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return NextResponse.json({ error: 'Amazon API not configured' }, { status: 500 })

  // Step 1: check our DB first (fast path for items listed through this dashboard)
  try {
    const rows = await sql`
      SELECT asin, title FROM listed_asins
      WHERE user_id = ${session.user.id} AND ebay_listing_id = ${itemId}
      LIMIT 1
    `
    if (rows[0]?.asin) {
      // Known item — do direct Amazon product lookup
      const asin = String(rows[0].asin)
      const amzRes = await fetch(
        `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`,
        { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(8000) }
      )
      const amzJson = await amzRes.json()
      const data = amzJson?.data ?? amzJson
      const price = parseFloat(String(data.product_price || '0').replace(/[^0-9.]/g, '')) || 0
      return NextResponse.json({
        asin,
        title: String(data.product_title || rows[0].title || asin),
        amazonPrice: price,
        imageUrl: String(data.product_photo || '') || undefined,
        amazonUrl: `https://www.amazon.com/dp/${asin}`,
        available: data.product_availability !== 'Currently unavailable' && price > 0,
        source: 'db',
      })
    }
  } catch { /* continue to eBay lookup */ }

  // Step 2: unknown item — look up the listing title from eBay, then search Amazon
  const token = await getFreshToken(session.user.id)
  if (!token) return NextResponse.json({ error: 'RECONNECT_REQUIRED' }, { status: 401 })

  const appId = process.env.EBAY_APP_ID || ''
  const ebayTitle = await getEbayItemTitle(itemId, token, appId)
  if (!ebayTitle) {
    return NextResponse.json({ error: `Item #${itemId} not found on eBay, or you do not own this listing.` }, { status: 404 })
  }

  // Step 3: search Amazon with the eBay listing title
  const searchRes = await fetch(
    `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(ebayTitle)}&country=US&category_id=aps&page=1`,
    { headers: { 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com', 'x-rapidapi-key': rapidKey }, signal: AbortSignal.timeout(8000) }
  )
  const searchJson = await searchRes.json()
  const products: Record<string, unknown>[] = searchJson?.data?.products || []

  if (products.length === 0) {
    return NextResponse.json({ error: `No Amazon match found for "${ebayTitle.slice(0, 60)}"` }, { status: 404 })
  }

  const top = products[0]
  const asin = String(top.asin || '')
  const price = parseFloat(String(top.product_price || '0').replace(/[^0-9.]/g, '')) || 0

  return NextResponse.json({
    asin,
    title: String(top.product_title || ebayTitle),
    amazonPrice: price,
    imageUrl: String(top.product_photo || '') || undefined,
    amazonUrl: `https://www.amazon.com/dp/${asin}`,
    available: price > 0,
    ebayTitle,
    source: 'search',
  })
}
