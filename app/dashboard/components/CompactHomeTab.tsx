import type { EbayOrder, Tab } from '../types'
import { getOrderDisplayStatus } from '../order-status'

function getFirstName(userName?: string | null) {
  const raw = String(userName || '').trim()
  if (!raw) return ''
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim()
  const first = cleaned.split(/\s+/)[0] || ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
}

function dotClassForTone(tone: 'green' | 'red' | 'gold' | 'blue') {
  if (tone === 'red') return 'pwa-order-row__dot pwa-order-row__dot--red'
  if (tone === 'blue') return 'pwa-order-row__dot pwa-order-row__dot--blue'
  if (tone === 'gold') return 'pwa-order-row__dot pwa-order-row__dot--gold'
  return 'pwa-order-row__dot pwa-order-row__dot--green'
}

export function CompactHomeTab({
  connected,
  awaitingCount,
  orders,
  userName,
  onOpenSettings,
  onGo,
}: {
  connected: boolean
  awaitingCount: number
  orders: EbayOrder[]
  userName?: string | null
  onOpenSettings: () => void
  onGo: (tab: Tab) => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = getFirstName(userName)
  const greetingLine = firstName ? `${greeting}, ${firstName}` : greeting

  const subtext = !connected
    ? 'Connect eBay to sync orders and keep listing.'
    : awaitingCount > 0
      ? `You have ${awaitingCount} order${awaitingCount > 1 ? 's' : ''} waiting to ship.`
      : "You're all caught up — no orders waiting to ship. Keep listing!"

  const recentOrders = orders.slice(0, 5)

  return (
    <div className="pwa-home">
      <h1 className="pwa-home__greeting">
        {greetingLine} <span aria-hidden>👋</span>
      </h1>
      <p className="pwa-home__sub">{subtext}</p>

      {!connected ? (
        <button type="button" className="pwa-home__connect btn btn-gold" onClick={onOpenSettings}>
          Connect eBay
        </button>
      ) : null}

      <div className="pwa-metric-grid">
        <div className="pwa-metric-card">
          <div className="pwa-metric-card__icon pwa-metric-card__icon--green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="pwa-metric-card__value">{awaitingCount}</div>
          <div className="pwa-metric-card__label">Needs to ship</div>
          <div className="pwa-metric-card__hint">{awaitingCount > 0 ? 'Awaiting shipment' : 'All caught up!'}</div>
        </div>
        <div className="pwa-metric-card">
          <div className="pwa-metric-card__icon pwa-metric-card__icon--blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
          </div>
          <div className="pwa-metric-card__value">{orders.length}</div>
          <div className="pwa-metric-card__label">Total orders</div>
          <div className="pwa-metric-card__hint">Loaded from eBay</div>
        </div>
        <div className="pwa-metric-card">
          <div className="pwa-metric-card__icon pwa-metric-card__icon--teal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="pwa-metric-card__value">{connected ? 'Live' : 'Offline'}</div>
          <div className="pwa-metric-card__label">eBay connection</div>
          <div className="pwa-metric-card__hint">{connected ? 'Syncing normally' : 'Tap status above'}</div>
        </div>
      </div>

      {connected && recentOrders.length > 0 ? (
        <section className="pwa-recent">
          <div className="pwa-recent__head">
            <h2 className="pwa-recent__title">Recent Orders</h2>
            <button type="button" className="pwa-recent__all" onClick={() => onGo('orders')}>
              View all →
            </button>
          </div>
          <div className="pwa-recent__list">
            {recentOrders.map((order) => {
              const title = order.lineItems?.[0]?.title?.slice(0, 72) || order.orderId
              const total = parseFloat(order.pricingSummary?.total?.value || '0')
              const date = new Date(order.creationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const status = getOrderDisplayStatus(order)
              const buyer = order.buyer?.username || 'Buyer'

              return (
                <button
                  key={order.orderId}
                  type="button"
                  className="pwa-order-row"
                  onClick={() => onGo('orders')}
                >
                  <span className={dotClassForTone(status.tone)} aria-hidden />
                  <span className="pwa-order-row__main">
                    <span className="pwa-order-row__title">{title}</span>
                    <span className="pwa-order-row__meta">
                      {buyer} · {date} · <span className={`pwa-order-row__status pwa-order-row__status--${status.tone}`}>{status.label}</span>
                    </span>
                  </span>
                  <span className="pwa-order-row__price">${total.toFixed(2)}</span>
                  <span className="pwa-order-row__chev" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : connected && orders.length === 0 ? (
        <section className="pwa-recent">
          <div className="pwa-recent__head">
            <h2 className="pwa-recent__title">Recent Orders</h2>
          </div>
          <div className="pwa-empty-card">No orders yet — sync from the menu when you’re ready.</div>
        </section>
      ) : null}
    </div>
  )
}
