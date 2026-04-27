export type Tab = 'overview' | 'orders' | 'financials' | 'scripts' | 'asin' | 'product' | 'settings'

export interface AsinResult {
  asin: string
  title: string
  amazonPrice: number
  imageUrl?: string
  images?: string[]
  features?: string[]
  description?: string
  specs?: Array<[string, string]>
  available: boolean
  amazonUrl?: string
  ebayTitle?: string
  confidence?: 'exact' | 'manual' | 'recovered' | 'search'
  source: 'api' | 'manual' | 'db' | 'search' | 'scrape' | 'cache' | 'fallback'
}

export interface EbayOrder {
  orderId: string
  buyer: { username: string }
  pricingSummary: { total: { value: string; currency: string } }
  fulfillmentStartInstructions?: Array<{ shippingStep?: { shipTo?: { fullName?: string } } }>
  lineItems?: Array<{
    title: string
    quantity: number
    lineItemCost: { value: string }
    sku?: string
    legacyItemId?: string
  }>
  orderFulfillmentStatus: string
  creationDate: string
}

export interface FinderProduct {
  asin: string
  title: string
  amazonPrice: number
  ebayPrice: number
  profit: number
  roi: number
  imageUrl?: string
  images?: string[]
  features?: string[]
  description?: string
  specs?: Array<[string, string]>
  risk: string
  salesVolume?: string
}

export interface ListResult {
  listingUrl: string
  listingId: string
}

export interface FinancialSummary {
  grossRevenue: number
  trackedRevenue: number
  amazonCost: number
  ebayFees: number
  profit: number
  roi: number
  margin: number
  soldItems: number
  trackedItems: number
  missingCostItems: number
  actualFeeItems?: number
  estimatedFeeItems?: number
  financeApiAvailable?: boolean
  financeApiStatus?: number | null
}

export interface FinancialItem {
  id: string
  orderId: string
  listingId: string | null
  asin: string | null
  title: string
  soldAt: string
  quantity: number
  ebayRevenue: number
  amazonUnitCost: number | null
  amazonCost: number | null
  ebayFeeRate: number
  ebayFees: number
  feeSource?: 'actual' | 'estimated'
  profit: number | null
  roi: number | null
  margin: number | null
  hasTrackedCost: boolean
}

export interface ListProgress {
  done: number
  total: number
  errors: number
}

export interface BannerState {
  tone: 'success' | 'error'
  text: string
}

export interface EbayCredentialsSummary {
  has_token?: boolean
  has_refresh_token?: boolean
  token_expired?: boolean
  sandbox_mode?: boolean
}

export interface ScriptMessage {
  file: string
  tone: 'success' | 'error' | 'info'
  text: string
}

export type OrderAsinMap = Record<string, { asin: string; title: string; amazonUrl?: string; imageUrl?: string; confidence?: 'manual' | 'exact' | 'recovered' | 'search' }>
