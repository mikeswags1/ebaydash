import type { BannerState, FinderProduct } from './types'
import { EBAY_DEFAULT_FEE_RATE, getRecommendedEbayPrice as getSharedRecommendedEbayPrice } from '@/lib/listing-pricing'

export function parseDashboardSearchMessage(search: string): BannerState | null {
  const params = new URLSearchParams(search)
  const ebay = params.get('ebay')
  const amazon = params.get('amazon')
  const msg = params.get('msg')

  if (ebay === 'error') {
    return { tone: 'error', text: msg ? decodeURIComponent(msg) : 'eBay connection failed.' }
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
  const ebayFee = parsedEbayPrice * feeRate
  const profit = parsedEbayPrice - amazonPrice - ebayFee - parsedShippingCost
  const roi = amazonPrice > 0 ? (profit / amazonPrice) * 100 : 0
  const margin = parsedEbayPrice > 0 ? (profit / parsedEbayPrice) * 100 : 0

  return {
    ebayFee,
    profit,
    roi,
    margin,
  }
}

export function getRecommendedEbayPrice(amazonPrice: number) {
  return getSharedRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
}

export async function listProductsInBatches(args: {
  products: FinderProduct[]
  publish: (product: FinderProduct) => Promise<{ asin?: string; reconnectRequired?: boolean }>
  onProgress: (progress: { done: number; total: number; errors: number }) => void
}) {
  const { products, publish, onProgress } = args
  const total = products.length
  const listedAsins: string[] = []
  let errors = 0
  let reconnectRequired = false

  for (let index = 0; index < total; index += 3) {
    if (reconnectRequired) break

    onProgress({ done: index, total, errors })
    const batch = products.slice(index, index + 3)
    const results = await Promise.all(batch.map((product) => publish(product)))

    results.forEach((result) => {
      if (result.reconnectRequired) {
        reconnectRequired = true
        return
      }

      if (result.asin) {
        listedAsins.push(result.asin)
      } else {
        errors += 1
      }
    })
  }

  onProgress({ done: total, total, errors })

  return {
    listedAsins,
    errors,
    reconnectRequired,
  }
}
