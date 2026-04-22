import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.amazon.com/',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return new Response('Image fetch failed', { status: 502 })

    const buffer = Buffer.from(await res.arrayBuffer())
    const trimmed = sharp(buffer).trim({ threshold: 10 })
    const normalized = await trimmed
      .resize(1400, 1400, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        withoutEnlargement: false,
      })
      .jpeg({ quality: 92 })
      .toBuffer()

    return new NextResponse(new Uint8Array(normalized), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
      },
    })
  } catch {
    return new Response('Error fetching image', { status: 500 })
  }
}
