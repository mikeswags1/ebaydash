import type { BannerState, FinderProduct } from './types'
import { EBAY_DEFAULT_FEE_RATE, getListingMetrics, getRecommendedEbayPrice as getSharedRecommendedEbayPrice } from '@/lib/listing-pricing'

export function parseDashboardSearchMessage(search: string): BannerState | null {
  const params = new URLSearchParams(search)
  const ebay = params.get('ebay')
  const amazon = params.get('amazon')
  const msg = params.get('msg')

  if (ebay === 'error') {
    const decoded = msg ? decodeURIComponent(msg) : ''
    const friendly = /fetch failed/i.test(decoded)
      ? 'Unable to reach eBay during connection. Please try again.'
      : decoded
    return { tone: 'error', text: friendly || 'eBay connection failed.' }
  }

  if (ebay === 'connected') {
    return { tone: 'success', text: 'eBay connected successfully.' }
  }

  if (amazon === 'error') {
    return { tone: 'error', text: msg ? `Amazon error: ${decodeURIComponent(msg)}` : 'Amazon connection failed.' }
  }

  if (amazon === 'connected') {
    return { tone: 'success', text: 'Amazon Seller account connected.' }
  }

  return null
}

export function getGrossRevenue(totalOrders: Array<{ pricingSummary?: { total?: { value?: string } } }>) {
  return totalOrders.reduce((sum, order) => sum + parseFloat(order.pricingSummary?.total?.value || '0'), 0)
}

export function getListingPreview(ebayPrice: string, amazonPrice: number, shippingCost: string, feeRate: number) {
  const parsedEbayPrice = parseFloat(ebayPrice) || 0
  const parsedShippingCost = parseFloat(shippingCost) || 0
  const metrics = getListingMetrics(amazonPrice + parsedShippingCost, parsedEbayPrice, feeRate)

  return {
    ebayFee: metrics.fees,
    profit: metrics.profit,
    roi: metrics.roi,
    margin: metrics.margin,
  }
}

export function getRecommendedEbayPrice(amazonPrice: number) {
  return getSharedRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
}

export async function listProductsInBatches(args: {
  products: FinderProduct[]
  publish: (product: FinderProduct) => Promise<{ asin?: string; reconnectRequired?: boolean }>
  onProgress: (progress: { done: number; total: number; errors: number }) => void
  concurrency?: number
}) {
  const { products, publish, onProgress, concurrency = 5 } = args
  const total = products.length
  const listedAsins: string[] = []
  let errors = 0
  let done = 0
  let reconnectRequired = false

  const publishWithRetry = async (product: FinderProduct) => {
    const result = await publish(product)
    // One automatic retry for transient network failures (empty result = unknown error)
    if (!result.asin && !result.reconnectRequired) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      return publish(product)
    }
    return result
  }

  for (let index = 0; index < total; index += concurrency) {
    if (reconnectRequired) break

    onProgress({ done, total, errors })
    const batch = products.slice(index, index + concurrency)

    // allSettled: one failure never kills its batchmates
    const settled = await Promise.allSettled(batch.map((product) => publishWithRetry(product)))

    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        errors += 1
        done += 1
        continue
      }
      const result = outcome.value
      if (result.reconnectRequired) {
        reconnectRequired = true
        break
      }
      if (result.asin) {
        listedAsins.push(result.asin)
      } else {
        errors += 1
      }
      done += 1
    }
  }

  onProgress({ done: total, total, errors })

  return { listedAsins, errors, reconnectRequired }
}
