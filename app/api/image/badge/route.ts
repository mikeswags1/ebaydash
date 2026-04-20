import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// Fallback green banner used when stamp PNG is not present
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
  // stamp=0 means plain proxy — just fetch and return the image, no badge overlay
  const addStamp = req.nextUrl.searchParams.get('stamp') !== '0'

  try {
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!imgRes.ok) return new NextResponse('Image fetch failed', { status: 502 })

    // Plain proxy mode — return image as-is
    if (!addStamp) {
      const buf = Buffer.from(await imgRes.arrayBuffer())
      const ct = imgRes.headers.get('content-type') || 'image/jpeg'
      return new NextResponse(buf as unknown as BodyInit, {
        headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=2592000' },
      })
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    const img = sharp(imgBuffer)
    const { width = 600, height = 600 } = await img.metadata()

    // Use the FREE SHIPPING stamp PNG if the file exists in /public
    const stampPath = join(process.cwd(), 'public', 'free-shipping-stamp.png')
    let composite: sharp.OverlayOptions

    if (existsSync(stampPath)) {
      // Stamp: 42% of image width, placed bottom-right with a small margin
      const stampSize = Math.round(width * 0.42)
      const margin = Math.round(width * 0.02)
      const stampBuf = await sharp(readFileSync(stampPath))
        .resize(stampSize, stampSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      composite = {
        input: stampBuf,
        top: height - stampSize - margin,
        left: width - stampSize - margin,
        blend: 'over',
      }
    } else {
      // Fallback: full-width green banner at bottom
      const bannerH = Math.round(68 * (width / 800))
      const scaledBanner = await sharp(BANNER_SVG)
        .resize(width, bannerH)
        .png()
        .toBuffer()
      composite = { input: scaledBanner, top: height - bannerH, left: 0 }
    }

    const result = await img
      .composite([composite])
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
