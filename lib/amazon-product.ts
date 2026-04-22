import { scrapeAmazonProduct } from '@/lib/amazon-scrape'

type FetchAmazonProductOptions = {
  asin: string
  fallbackImage?: string
}

export type ValidatedAmazonProduct = {
  asin: string
  title: string
  amazonPrice: number
  images: string[]
  imageUrl?: string
  available: boolean
  source: 'api' | 'scrape'
}

function normalizeImageUrl(value: unknown) {
  const url = String(value || '').trim()
  return url.startsWith('http') ? url : ''
}

function parseAmazonPrice(value: unknown) {
  if (typeof value === 'number') return value
  const parsed = parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function dedupeImages(values: string[]) {
  return Array.from(new Set(values.filter((url) => url.startsWith('http'))))
}

export async function fetchAmazonProductByAsin(
  options: FetchAmazonProductOptions
): Promise<ValidatedAmazonProduct | null> {
  const asin = options.asin.toUpperCase().trim()
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null

  const rapidKey = process.env.RAPIDAPI_KEY
  if (rapidKey) {
    try {
      const url = `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
          'x-rapidapi-key': rapidKey,
        },
        signal: AbortSignal.timeout(10000),
      })

      if (res.status !== 429 && res.status !== 403) {
        const json = await res.json()
        const data = json?.data ?? json
        const quotaMsg = String(data?.message || '').toLowerCase()

        if (!quotaMsg.match(/limit|quota|exceed/)) {
          const title = String(data.product_title || data.title || '').trim()
          const rawPhotos: unknown[] = Array.isArray(data.product_photos) ? data.product_photos : []
          const images = dedupeImages([
            ...rawPhotos.flatMap((photo: unknown) => {
              if (typeof photo === 'string') return [photo]
              if (photo && typeof photo === 'object') {
                const record = photo as Record<string, unknown>
                return [
                  normalizeImageUrl(record.url),
                  normalizeImageUrl(record.large),
                  normalizeImageUrl(record.hiRes),
                  normalizeImageUrl(record.main),
                  normalizeImageUrl(record.thumb),
                ]
              }
              return []
            }),
            normalizeImageUrl(data.product_photo),
            normalizeImageUrl(options.fallbackImage),
          ])
          const amazonPrice = parseAmazonPrice(data.product_price || data.price)
          const available =
            String(data.product_availability || '').toLowerCase() !== 'currently unavailable' &&
            amazonPrice > 0

          if (title && images[0] && amazonPrice > 0) {
            return {
              asin,
              title,
              amazonPrice,
              images,
              imageUrl: images[0],
              available,
              source: 'api',
            }
          }
        }
      }
    } catch {
      // Fall through to direct scrape.
    }
  }

  const scraped = await scrapeAmazonProduct(asin)
  if (!scraped || !scraped.title || scraped.price <= 0 || scraped.images.length === 0) return null

  const images = dedupeImages([...scraped.images, normalizeImageUrl(options.fallbackImage)])

  if (images.length === 0) return null

  return {
    asin,
    title: scraped.title,
    amazonPrice: scraped.price,
    images,
    imageUrl: images[0],
    available: scraped.available && scraped.price > 0,
    source: 'scrape',
  }
}
