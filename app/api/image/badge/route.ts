import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// SVG banner rendered onto the bottom of the main product image
const BANNER_SVG = Buffer.from(
  `<svg width="600" height="54" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="54" fill="rgba(22,163,74,0.92)"/>
    <text x="300" y="35" font-family="Arial,Helvetica,sans-serif" font-size="22"
      font-weight="bold" fill="white" text-anchor="middle">FREE SHIPPING  ·  1–3 DAY DELIVERY</text>
  </svg>`
)

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

  try {
    const imgRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!imgRes.ok) return new NextResponse('Image fetch failed', { status: 502 })
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    const img = sharp(imgBuffer)
    const { width = 600, height = 600 } = await img.metadata()

    // Scale banner to image width, position at bottom
    const bannerWidth = width
    const bannerHeight = Math.round(54 * (bannerWidth / 600))
    const bannerTop = height - bannerHeight

    const scaledBanner = await sharp(BANNER_SVG)
      .resize(bannerWidth, bannerHeight)
      .png()
      .toBuffer()

    const result = await img
      .composite([{ input: scaledBanner, top: bannerTop, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer()

    return new NextResponse(result as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800',
      },
    })
  } catch (e) {
    console.error('Badge image error:', e)
    return new NextResponse('Error processing image', { status: 500 })
  }
}
