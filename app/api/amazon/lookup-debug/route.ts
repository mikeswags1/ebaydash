import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const asin = req.nextUrl.searchParams.get('asin') || 'B0CTNTFBNX'
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return NextResponse.json({ error: 'no key' })

  const url = `https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-lookup-product?url=https%3A%2F%2Fwww.amazon.com%2Fdp%2F${asin}`
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })
    const data = await res.json()
    // Return the full response so we can see every field name
    return NextResponse.json({ asin, status: res.status, data })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
