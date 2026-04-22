import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const STAMP_PATH = path.join(process.cwd(), 'public', 'free-shipping-stamp.png')

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitTitle(title: string) {
  const words = title.trim().split(/\s+/).slice(0, 14)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > 28 && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 4)
}

async function buildFallbackImage(title: string, asin: string) {
  const stampBuffer = await fs.readFile(STAMP_PATH)
  const width = 1400
  const height = 1400
  const titleLines = splitTitle(title || `Amazon Product ${asin}`)
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f6f1e6" />
          <stop offset="100%" stop-color="#e3d2a1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect x="78" y="78" width="${width - 156}" height="${height - 156}" rx="48" fill="#fffaf0" stroke="#c8a250" stroke-width="6" />
      <text x="120" y="220" fill="#8f6d2d" font-size="40" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="4">EBAYDASH LISTING</text>
      ${titleLines
        .map(
          (line, index) =>
            `<text x="120" y="${360 + index * 94}" fill="#23180b" font-size="58" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeHtml(line)}</text>`
        )
        .join('')}
      <text x="120" y="980" fill="#4a3920" font-size="36" font-family="Arial, Helvetica, sans-serif">ASIN: ${escapeHtml(asin)}</text>
      <text x="120" y="1070" fill="#4a3920" font-size="34" font-family="Arial, Helvetica, sans-serif">Fast handling, free shipping, 30-day returns</text>
    </svg>
  `
  const stampWidth = 360
  const stamp = await sharp(stampBuffer).resize({ width: stampWidth }).png().toBuffer()

  return sharp(Buffer.from(svg))
    .composite([
      {
        input: stamp,
        top: 30,
        left: width - stampWidth - 30,
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const title = req.nextUrl.searchParams.get('title')?.trim() || 'Amazon Product'
  const asin = req.nextUrl.searchParams.get('asin')?.trim() || 'UNKNOWNASIN'

  try {
    if (!url || !url.startsWith('http')) {
      const fallback = await buildFallbackImage(title, asin)
      return new NextResponse(new Uint8Array(fallback), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=2592000',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const [imageResponse, stampBuffer] = await Promise.all([
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://www.amazon.com/',
        },
        signal: AbortSignal.timeout(10000),
      }),
      fs.readFile(STAMP_PATH),
    ])

    if (!imageResponse.ok) {
      const fallback = await buildFallbackImage(title, asin)
      return new NextResponse(new Uint8Array(fallback), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=2592000',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const sourceBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const source = sharp(sourceBuffer)
    const metadata = await source.metadata()
    const width = metadata.width || 1200
    const height = metadata.height || 1200

    const stampWidth = Math.max(220, Math.round(width * 0.26))
    const stamp = await sharp(stampBuffer)
      .resize({ width: stampWidth })
      .png()
      .toBuffer()

    const output = await source
      .composite([
        {
          input: stamp,
          top: 24,
          left: Math.max(24, width - stampWidth - 24),
        },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    try {
      const fallback = await buildFallbackImage(title, asin)
      return new NextResponse(new Uint8Array(fallback), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=2592000',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch {
      return new NextResponse('Error generating image badge', { status: 500 })
    }
  }
}
