import type { AsinResult, EbayCredentialsSummary, EbayOrder, FinancialItem, FinancialSummary, FinderProduct, ListResult, OrderAsinMap } from './types'

export class DashboardApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'DashboardApiError'
    this.code = code
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const data = await response.json().catch(() => null)

  if (data?.ok === false && data?.error) {
    throw new DashboardApiError(data.error.message || 'Request failed.', data.error.code)
  }

  if (!response.ok) {
    const code = data?.error?.code || data?.code || data?.error
    const message = data?.error?.message || data?.error || data?.message || `Request failed (${response.status})`
    throw new DashboardApiError(message, code)
  }

  if (data?.error) {
    const code = typeof data.error === 'string' ? data.error : data.error?.code
    const message = typeof data.error === 'string' ? data.error : data.error?.message || 'Request failed.'
    throw new DashboardApiError(message, code)
  }

  return data as T
}

export function isReconnectError(error: unknown) {
  return error instanceof DashboardApiError && error.code === 'RECONNECT_REQUIRED'
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DashboardApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function fetchOrders() {
  return requestJson<{ ok: true; connected: boolean; recent?: EbayOrder[]; awaiting?: EbayOrder[] }>('/api/ebay/orders')
}

export async function fetchFinancials() {
  return requestJson<{ ok: true; connected: boolean; summary: FinancialSummary; items: FinancialItem[] }>('/api/financials')
}

export async function fetchEbayCredentials() {
  return requestJson<{ ok: true; credentials: EbayCredentialsSummary | null }>('/api/ebay/credentials')
}

export async function disconnectEbay() {
  return requestJson<{ ok: true; success: true }>('/api/ebay/credentials', {
    method: 'DELETE',
  })
}

export async function fetchUserNiche() {
  return requestJson<{ ok: true; niche: string | null }>('/api/user/niche')
}

export async function saveUserNiche(niche: string) {
  return requestJson<{ ok: true; success: true; niche: string }>('/api/user/niche', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ niche }),
  })
}

export async function fetchAmazonCredentials() {
  return requestJson<{ ok: true; connected: boolean; sellingPartnerId?: string }>('/api/amazon/credentials')
}

export async function fetchOrderAsinMap() {
  return requestJson<{ ok: true; map: OrderAsinMap }>('/api/amazon/order-asins')
}

export async function lookupAsinByItemId(itemId: string) {
  return requestJson<AsinResult>(`/api/fulfillment/lookup?itemId=${itemId}`)
}

export async function saveManualAsinMapping(itemId: string, asin: string) {
  return requestJson<AsinResult>('/api/fulfillment/manual-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, asin }),
  })
}

export async function validateAmazonAsin(asin: string) {
  return requestJson<AsinResult>(`/api/amazon/lookup?asin=${encodeURIComponent(asin)}`)
}

export async function runDashboardScript(file: string) {
  return requestJson<{ ok: true; message?: string }>(`/api/scripts/run?script=${file}`)
}

export async function fetchFinderProducts(niche: string, refresh = false) {
  const params = new URLSearchParams({ niche })
  if (refresh) params.set('refresh', '1')
  return requestJson<{ ok: true; results: FinderProduct[] }>(`/api/scripts/product-finder?${params.toString()}`)
}

export async function publishProduct(input: {
  asin: string
  title: string
  ebayPrice: number
  amazonPrice: number
  imageUrl?: string
  images?: string[]
  features?: string[]
  description?: string
  specs?: Array<[string, string]>
  niche: string | null
}) {
  return requestJson<ListResult>('/api/ebay/list-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
