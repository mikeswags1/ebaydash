import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const STAMP_PATH = path.join(process.cwd(), 'public', 'free-shipping-stamp.png')

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url || !url.startsWith('http')) return new NextResponse('Missing url', { status: 400 })

  try {
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

    if (!imageResponse.ok) return new NextResponse('Image fetch failed', { status: 502 })

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
    return new NextResponse('Error generating image badge', { status: 500 })
  }
}
