import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows } from '@/lib/db'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'

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
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/xml',
    },
    body: xml,
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return null

  const text = await res.text()
  const titleMatch = text.match(/<Title>(.*?)<\/Title>/)
  return titleMatch?.[1]?.trim() || null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const itemId = req.nextUrl.searchParams.get('itemId')?.trim()
  if (!itemId || !/^\d+$/.test(itemId)) {
    return apiError('Invalid eBay item ID.', { status: 400, code: 'INVALID_ITEM_ID' })
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    return apiError('Amazon product lookup is not configured.', {
      status: 503,
      code: 'AMAZON_LOOKUP_NOT_CONFIGURED',
    })
  }

  try {
    const rows = await queryRows<{ asin?: string; title?: string }>`
      SELECT asin, title
      FROM listed_asins
      WHERE user_id = ${session.user.id} AND ebay_listing_id = ${itemId}
      LIMIT 1
    `

    if (rows[0]?.asin) {
      const asin = String(rows[0].asin)
      const amzRes = await fetch(
        `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`,
        {
          headers: {
            'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
            'x-rapidapi-key': rapidKey,
          },
          signal: AbortSignal.timeout(8000),
        }
      )

      if (!amzRes.ok) {
        return apiError('Amazon lookup failed for this item.', {
          status: 502,
          code: 'AMAZON_LOOKUP_FAILED',
          details: `status=${amzRes.status}`,
        })
      }

      const amzJson = await amzRes.json()
      const data = amzJson?.data ?? amzJson
      const price = parseFloat(String(data.product_price || '0').replace(/[^0-9.]/g, '')) || 0

      return apiOk({
        asin,
        title: String(data.product_title || rows[0].title || asin),
        amazonPrice: price,
        imageUrl: String(data.product_photo || '') || undefined,
        amazonUrl: `https://www.amazon.com/dp/${asin}`,
        available: data.product_availability !== 'Currently unavailable' && price > 0,
        source: 'db' as const,
      })
    }
  } catch {
    // Fall through to the eBay lookup path.
  }

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect your account in Settings.', {
      status: 401,
      code: 'RECONNECT_REQUIRED',
    })
  }

  const appId = process.env.EBAY_APP_ID || ''
  const ebayTitle = await getEbayItemTitle(itemId, credentials.accessToken, appId)
  if (!ebayTitle) {
    return apiError(`Item #${itemId} was not found on eBay, or it is not owned by this account.`, {
      status: 404,
      code: 'ITEM_NOT_FOUND',
    })
  }

  const searchRes = await fetch(
    `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(ebayTitle)}&country=US&category_id=aps&page=1`,
    {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
      signal: AbortSignal.timeout(8000),
    }
  )

  if (!searchRes.ok) {
    return apiError('Amazon search failed for this listing title.', {
      status: 502,
      code: 'AMAZON_SEARCH_FAILED',
      details: `status=${searchRes.status}`,
    })
  }

  const searchJson = await searchRes.json()
  const products: Record<string, unknown>[] = searchJson?.data?.products || []

  if (products.length === 0) {
    return apiError(`No Amazon match was found for "${ebayTitle.slice(0, 60)}".`, {
      status: 404,
      code: 'AMAZON_MATCH_NOT_FOUND',
    })
  }

  const top = products[0]
  const asin = String(top.asin || '')
  const price = parseFloat(String(top.product_price || '0').replace(/[^0-9.]/g, '')) || 0

  return apiOk({
    asin,
    title: String(top.product_title || ebayTitle),
    amazonPrice: price,
    imageUrl: String(top.product_photo || '') || undefined,
    amazonUrl: `https://www.amazon.com/dp/${asin}`,
    available: price > 0,
    ebayTitle,
    source: 'search' as const,
  })
}
