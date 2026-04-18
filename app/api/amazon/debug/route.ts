import { NextResponse } from 'next/server'

export async function GET() {
  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) return NextResponse.json({ error: 'no key' })

  const keyPreview = rapidKey.length > 8 ? `${rapidKey.slice(0, 4)}...${rapidKey.slice(-4)} (${rapidKey.length} chars)` : `TOO SHORT (${rapidKey.length})`

  try {
    const searchRes = await fetch(
      'https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com/amz/amazon-search-by-keyword-asin?keyword=resistance+bands&domainCode=com&sortBy=relevanceblender&numberOfProducts=3',
      { headers: { 'x-rapidapi-host': 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com', 'x-rapidapi-key': rapidKey } }
    )
    const searchData = await searchRes.json()
    return NextResponse.json({ keyPreview, searchStatus: searchRes.status, searchData })
  } catch (e) {
    return NextResponse.json({ keyPreview, error: String(e) })
  }
}
