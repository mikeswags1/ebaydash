import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asin = req.nextUrl.searchParams.get('asin')
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json({ error: 'Invalid ASIN — must be 10 characters e.g. B08N5WRWNW' })
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    return NextResponse.json({ error: 'Amazon API not configured' }, { status: 500 })
  }

  try {
    const url = `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-lookup-product?url=https%3A%2F%2Fwww.amazon.com%2Fdp%2F${asin}`

    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })

    const data = await res.json()

    if (!res.ok || data.type === 'error') {
      console.error('RapidAPI error:', data)
      return NextResponse.json({ error: data.message || 'Product not found' })
    }

    const price = data.price ?? data.currentPrice ?? 0
    const title = data.productTitle ?? data.title ?? asin
    const imageUrl = data.imageUrl ?? data.mainImageUrl ?? undefined
    const available = data.warehouseAvailability !== 'NOT_AVAILABLE' && price > 0

    return NextResponse.json({
      asin,
      title,
      amazonPrice: typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price,
      imageUrl,
      available,
      source: 'api',
    })
  } catch (e) {
    console.error('Amazon lookup error:', e)
    return NextResponse.json({ error: 'Lookup failed — try again' })
  }
}
