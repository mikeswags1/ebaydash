import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asin = req.nextUrl.searchParams.get('asin')
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json({ error: 'Invalid ASIN format. ASINs are 10 characters (e.g. B08N5WRWNW)' })
  }

  // Try Amazon PA-API if credentials are configured
  const accessKey = process.env.AMAZON_ACCESS_KEY
  const secretKey = process.env.AMAZON_SECRET_KEY
  const partnerTag = process.env.AMAZON_PARTNER_TAG

  if (accessKey && secretKey && partnerTag) {
    try {
      const result = await fetchFromPAAPI(asin, accessKey, secretKey, partnerTag)
      if (result) return NextResponse.json(result)
    } catch (e) {
      console.error('PA-API error:', e)
    }
  }

  // Fallback: return the ASIN with a note that manual price entry is needed
  return NextResponse.json({
    asin,
    title: `Amazon product ${asin}`,
    amazonPrice: 0,
    available: true,
    source: 'manual' as const,
    needsManualPrice: true,
    amazonUrl: `https://www.amazon.com/dp/${asin}`,
  })
}

async function fetchFromPAAPI(
  asin: string,
  accessKey: string,
  secretKey: string,
  partnerTag: string
) {
  const endpoint = 'webservices.amazon.com'
  const path = '/paapi5/getitems'
  const region = 'us-east-1'
  const service = 'ProductAdvertisingAPI'

  const payload = JSON.stringify({
    ItemIds: [asin],
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Resources: [
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Offers.Listings.Availability.Message',
      'Images.Primary.Medium',
    ],
  })

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: endpoint,
    'x-amz-date': amzDate,
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
  }

  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')

  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload))
  const payloadHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const crHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))
  const crHash = Array.from(new Uint8Array(crHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crHash}`

  const toBuffer = (k: ArrayBuffer | Uint8Array): ArrayBuffer =>
    k instanceof Uint8Array ? k.buffer.slice(k.byteOffset, k.byteOffset + k.byteLength) as ArrayBuffer : k
  const sign = async (key: ArrayBuffer | Uint8Array, msg: string) =>
    crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', toBuffer(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(msg))

  const kDate = await sign(encoder.encode(`AWS4${secretKey}`), dateStamp)
  const kRegion = await sign(kDate, region)
  const kService = await sign(kRegion, service)
  const kSigning = await sign(kService, 'aws4_request')
  const sigBuffer = await sign(kSigning, stringToSign)
  const signature = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(`https://${endpoint}${path}`, {
    method: 'POST',
    headers: { ...headers, Authorization: authHeader },
    body: payload,
  })

  const data = await res.json()
  const item = data.ItemsResult?.Items?.[0]
  if (!item) return null

  const price = item.Offers?.Listings?.[0]?.Price?.Amount || 0
  const available = !!item.Offers?.Listings?.[0]
  const title = item.ItemInfo?.Title?.DisplayValue || asin
  const imageUrl = item.Images?.Primary?.Medium?.URL

  return { asin, title, amazonPrice: price, available, imageUrl, source: 'api' as const }
}
