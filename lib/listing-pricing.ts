export const EBAY_DEFAULT_FEE_RATE = 0.15
export const MIN_HEALTHY_PROFIT = 22
export const MIN_HEALTHY_ROI = 70
export const MIN_HEALTHY_MARGIN = 24

export function getTargetProfit(amazonPrice: number) {
  if (amazonPrice < 15) return 14
  if (amazonPrice < 25) return 18
  if (amazonPrice < 40) return 24
  if (amazonPrice < 75) return 34
  if (amazonPrice < 125) return Math.max(46, amazonPrice * 0.38)
  if (amazonPrice < 200) return Math.max(68, amazonPrice * 0.42)
  return Math.max(96, amazonPrice * 0.45)
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
