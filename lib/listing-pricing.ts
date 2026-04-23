export const EBAY_DEFAULT_FEE_RATE = 0.15

export function getTargetProfit(amazonPrice: number) {
  if (amazonPrice < 15) return 7
  if (amazonPrice < 40) return 12
  if (amazonPrice < 100) return 20
  if (amazonPrice < 175) return Math.max(32, amazonPrice * 0.2)
  return Math.max(45, amazonPrice * 0.24)
}

export function getRecommendedEbayPrice(amazonPrice: number, feeRate = EBAY_DEFAULT_FEE_RATE) {
  const targetProfit = getTargetProfit(amazonPrice)
  const rawEbayPrice = (amazonPrice + targetProfit) / (1 - feeRate)
  return Math.ceil(rawEbayPrice) - 0.01
}

