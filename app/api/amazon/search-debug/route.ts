import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword') || 'wireless earbuds bluetooth'
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return NextResponse.json({ error: 'no key' })

  const url = `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(keyword)}&country=US&category_id=aps&page=1`
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        'x-rapidapi-key': rapidKey,
      },
    })
    const data = await res.json()
    const firstProduct = data?.data?.products?.[0] || null
    return NextResponse.json({ status: res.status, firstProduct, topKeys: Object.keys(data) })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
