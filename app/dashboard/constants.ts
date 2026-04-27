import type { Tab } from './types'

export const NAV_ITEMS: Array<{ id: Tab; label: string; badge?: 'orders' }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders', badge: 'orders' },
  { id: 'financials', label: 'Financials' },
  { id: 'performance', label: 'Performance' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'asin', label: 'ASIN Lookup' },
  { id: 'product', label: 'Product Listing' },
  { id: 'continuous', label: 'Continuous Listing' },
  { id: 'settings', label: 'Settings' },
]

export const EBAY_FEE_RATE = 0.1325
