import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword') || 'wireless earbuds bluetooth'
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return NextResponse.json({ error: 'no key' })

  const url = `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-search-by-keyword-asin?keyword=${encodeURIComponent(keyword)}&domainCode=com&sortBy=relevanceblender&numberOfProducts=5&page=1`
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })
    const data = await res.json()
    // Show top-level keys and first product raw shape
    const topKeys = Object.keys(data)
    const firstProduct = (
      data.searchProductDetails?.[0] ||
      data.products?.[0] ||
      data.items?.[0] ||
      data.results?.[0] ||
      null
    )
    return NextResponse.json({ status: res.status, topKeys, firstProduct, rawSample: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
