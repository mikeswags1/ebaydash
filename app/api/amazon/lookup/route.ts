import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asin = req.nextUrl.searchParams.get('asin')
  if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
    return NextResponse.json({ error: 'Invalid ASIN — must be 10 characters e.g. B08N5WRWNW' })
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    return NextResponse.json({ error: 'Amazon API not configured' }, { status: 500 })
  }

  try {
    const url = `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin.toUpperCase()}&country=US`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
      signal: AbortSignal.timeout(8000),
    })

    const json = await res.json()
    const data = json?.data ?? json

    const title = String(data.product_title || data.title || asin)
    const rawPrice = data.product_price || data.price || '0'
    const price = typeof rawPrice === 'number'
      ? rawPrice
      : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0
    const imageUrl = String(data.product_photo || data.imageUrl || '')
    const available = data.product_availability !== 'Currently unavailable' && price > 0

    if (!title || title === asin) {
      return NextResponse.json({ error: 'Product not found — check the ASIN and try again' })
    }

    return NextResponse.json({
      asin: asin.toUpperCase(),
      title,
      amazonPrice: price,
      imageUrl: imageUrl || undefined,
      available,
      source: 'api',
    })
  } catch (e) {
    console.error('Amazon lookup error:', e)
    return NextResponse.json({ error: 'Lookup failed — try again' })
  }
}
