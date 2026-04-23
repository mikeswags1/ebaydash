export const EBAY_DEFAULT_FEE_RATE = 0.15

export function getTargetProfit(amazonPrice: number) {
  if (amazonPrice < 15) return 8
  if (amazonPrice < 25) return 11
  if (amazonPrice < 40) return 15
  if (amazonPrice < 75) return 22
  if (amazonPrice < 125) return Math.max(30, amazonPrice * 0.28)
  if (amazonPrice < 200) return Math.max(45, amazonPrice * 0.3)
  return Math.max(65, amazonPrice * 0.33)
}

export function getRecommendedEbayPrice(amazonPrice: number, feeRate = EBAY_DEFAULT_FEE_RATE) {
  const targetProfit = getTargetProfit(amazonPrice)
  const rawEbayPrice = (amazonPrice + targetProfit) / (1 - feeRate)
  return Math.ceil(rawEbayPrice) - 0.01
}
