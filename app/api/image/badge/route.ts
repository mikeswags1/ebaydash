import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// Clean professional FREE SHIPPING banner — bottom strip on product image
const BANNER_SVG = Buffer.from(
  `<svg width="800" height="68" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="68" fill="rgb(21,128,61)"/>
    <rect x="0" y="0" width="800" height="3" fill="rgb(74,222,128)"/>
    <text x="400" y="44" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="24"
      font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">
      FREE SHIPPING  |  2-3 DAY DELIVERY
    </text>
  </svg>`
)

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

  try {
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!imgRes.ok) return new NextResponse('Image fetch failed', { status: 502 })
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    const img = sharp(imgBuffer)
    const { width = 600, height = 600 } = await img.metadata()

    const bannerH = Math.round(68 * (width / 800))
    const bannerTop = height - bannerH

    const scaledBanner = await sharp(BANNER_SVG)
      .resize(width, bannerH)
      .png()
      .toBuffer()

    const result = await img
      .composite([{ input: scaledBanner, top: bannerTop, left: 0 }])
      .jpeg({ quality: 93 })
      .toBuffer()

    return new NextResponse(result as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
      },
    })
  } catch (e) {
    console.error('Badge image error:', e)
    return new NextResponse('Error processing image', { status: 500 })
  }
}
