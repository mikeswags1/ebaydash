import type { EbayOrder } from './types'

type BadgeTone = 'green' | 'red' | 'gold' | 'blue'

export type OrderDisplayStatus = {
  label: string
  tone: BadgeTone
}

function parseAmount(value?: string) {
  const amount = parseFloat(value || '0')
  return Number.isFinite(amount) ? amount : 0
}

function getRefunds(order: EbayOrder) {
  const orderRefunds = order.paymentSummary?.refunds || []
  const lineRefunds = (order.lineItems || []).flatMap((lineItem) => lineItem.refunds || [])
  return [...orderRefunds, ...lineRefunds]
}

function getRefundStatuses(order: EbayOrder) {
  return new Set(
    [
      order.orderPaymentStatus,
      ...getRefunds(order).map((refund) => refund.refundStatus),
    ]
      .map((status) => String(status || '').toUpperCase())
      .filter(Boolean)
  )
}

export function getOrderRefundState(order: EbayOrder): 'full' | 'partial' | 'pending' | null {
  const refunds = getRefunds(order)
  const statuses = getRefundStatuses(order)
  const cancelState = String(order.cancelStatus?.cancelState || '').toUpperCase()
  const refundTotal = refunds.reduce((sum, refund) => sum + parseAmount(refund.amount?.value), 0)
  const orderTotal = parseAmount(order.pricingSummary?.total?.value)

  if (statuses.has('FULLY_REFUNDED')) return 'full'
  if (statuses.has('PARTIALLY_REFUNDED')) return 'partial'
  if (statuses.has('PENDING') && refunds.length > 0) return 'pending'
  if (refundTotal > 0 && orderTotal > 0 && refundTotal >= orderTotal * 0.95) return 'full'
  if (refundTotal > 0) return 'partial'
  if (cancelState.includes('CANCEL') && refunds.length > 0) return 'full'

  return null
}

export function isRefundedOrder(order: EbayOrder) {
  return getOrderRefundState(order) !== null
}

export function getOrderDisplayStatus(order: EbayOrder): OrderDisplayStatus {
  const refundState = getOrderRefundState(order)

  if (refundState === 'full') return { label: 'Refunded', tone: 'blue' }
  if (refundState === 'partial') return { label: 'Partial Refund', tone: 'gold' }
  if (refundState === 'pending') return { label: 'Refund Pending', tone: 'gold' }
  if (order.orderFulfillmentStatus === 'NOT_STARTED') return { label: 'Ship Now', tone: 'red' }
  if (order.orderFulfillmentStatus === 'IN_PROGRESS') return { label: 'In Progress', tone: 'gold' }

  return { label: 'Fulfilled', tone: 'green' }
}

export function getOrderBadgeColors(tone: BadgeTone) {
  if (tone === 'red') {
    return {
      background: 'rgba(232,63,80,0.12)',
      color: 'var(--red)',
      border: 'rgba(232,63,80,0.25)',
    }
  }

  if (tone === 'gold') {
    return {
      background: 'rgba(200,162,80,0.12)',
      color: 'var(--gold)',
      border: 'rgba(200,162,80,0.25)',
    }
  }

  if (tone === 'blue') {
    return {
      background: 'rgba(82,151,255,0.12)',
      color: '#74a9ff',
      border: 'rgba(82,151,255,0.28)',
    }
  }

  return {
    background: 'rgba(46,207,118,0.10)',
    color: 'var(--grn)',
    border: 'rgba(46,207,118,0.22)',
  }
}
