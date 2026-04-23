export const EBAY_DEFAULT_FEE_RATE = 0.15
export const MIN_HEALTHY_PROFIT = 18
export const MIN_HEALTHY_ROI = 55
export const MIN_HEALTHY_MARGIN = 20

export function getTargetProfit(amazonPrice: number) {
  if (amazonPrice < 15) return 12
  if (amazonPrice < 25) return 16
  if (amazonPrice < 40) return 20
  if (amazonPrice < 75) return 28
  if (amazonPrice < 125) return Math.max(38, amazonPrice * 0.34)
  if (amazonPrice < 200) return Math.max(58, amazonPrice * 0.37)
  return Math.max(82, amazonPrice * 0.4)
}

export function getRecommendedEbayPrice(amazonPrice: number, feeRate = EBAY_DEFAULT_FEE_RATE) {
  const targetProfit = getTargetProfit(amazonPrice)
  const rawEbayPrice = (amazonPrice + targetProfit) / (1 - feeRate)
  return Math.ceil(rawEbayPrice) - 0.01
}

export function getListingMetrics(amazonPrice: number, ebayPrice: number, feeRate = EBAY_DEFAULT_FEE_RATE) {
  const fees = parseFloat((ebayPrice * feeRate).toFixed(2))
  const profit = parseFloat((ebayPrice - amazonPrice - fees).toFixed(2))
  const roi = amazonPrice > 0 ? parseFloat(((profit / amazonPrice) * 100).toFixed(1)) : 0
  const margin = ebayPrice > 0 ? parseFloat(((profit / ebayPrice) * 100).toFixed(1)) : 0
  return { fees, profit, roi, margin }
}

export function isHealthyListing(amazonPrice: number, ebayPrice: number, feeRate = EBAY_DEFAULT_FEE_RATE) {
  const metrics = getListingMetrics(amazonPrice, ebayPrice, feeRate)
  return (
    metrics.profit >= MIN_HEALTHY_PROFIT &&
    metrics.roi >= MIN_HEALTHY_ROI &&
    metrics.margin >= MIN_HEALTHY_MARGIN
  )
}
