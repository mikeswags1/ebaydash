import type { Tab } from './types'
import { EBAY_DEFAULT_FEE_RATE } from '@/lib/listing-pricing'

export const NAV_ITEMS: Array<{ id: Tab; label: string; badge?: 'orders' }> = [
  { id: 'overview', label: '🏠 Overview' },
  { id: 'orders', label: '📦 Orders', badge: 'orders' },
  { id: 'fulfillment', label: '🚚 Fulfillment' },
  { id: 'financials', label: '💰 Financials' },
  { id: 'performance', label: '📈 Performance' },
  { id: 'scripts', label: '⚙️ Scripts' },
  { id: 'asin', label: '🔍 ASIN Lookup' },
  { id: 'product', label: '🛒 Product Listing' },
  { id: 'continuous', label: '🔄 Continuous Listing' },
  { id: 'campaigns', label: '📢 Campaigns' },
  { id: 'settings', label: '⚙️ Settings' },
]

export const EBAY_FEE_RATE = EBAY_DEFAULT_FEE_RATE
