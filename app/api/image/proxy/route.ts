export const runtime = 'edge'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return new Response('Image fetch failed', { status: 502 })

    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
      },
    })
  } catch {
    return new Response('Error fetching image', { status: 500 })
  }
}
