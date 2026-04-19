import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// Clean professional FREE SHIPPING banner — bottom strip on product image
// Font stack targets fonts available on Vercel's Amazon Linux (librsvg/fontconfig):
// FreeSans (GNU FreeFont), Liberation Sans, DejaVu Sans — no letter-spacing or
// non-ASCII chars which can cause rendering issues on minimal server environments
const BANNER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="68">
    <rect width="800" height="68" fill="#15803d"/>
    <rect width="800" height="4" fill="#4ade80"/>
    <text x="400" y="44"
      font-family="FreeSans,Liberation Sans,DejaVu Sans,Ubuntu,Helvetica,Arial,sans-serif"
      font-size="26" font-weight="bold" fill="white" text-anchor="middle">
      FREE SHIPPING - 2-3 DAY DELIVERY
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
