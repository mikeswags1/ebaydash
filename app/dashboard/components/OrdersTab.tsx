import type { EbayOrder } from '../types'
import { useMemo, useState } from 'react'
import { getOrderDisplayStatus } from '../order-status'
import { EmptyState, OrderTable } from './shared'

function dotClassForTone(tone: 'green' | 'red' | 'gold' | 'blue') {
  if (tone === 'red') return 'pwa-order-row__dot pwa-order-row__dot--red'
  if (tone === 'blue') return 'pwa-order-row__dot pwa-order-row__dot--blue'
  if (tone === 'gold') return 'pwa-order-row__dot pwa-order-row__dot--gold'
  return 'pwa-order-row__dot pwa-order-row__dot--green'
}

type CompactOrdersFilter = 'all' | 'needs_ship' | 'fulfilled' | 'refunded'

function matchesQuery(order: EbayOrder, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = String(order.lineItems?.[0]?.title || '').toLowerCase()
  const buyer = String(order.buyer?.username || '').toLowerCase()
  const orderId = String(order.orderId || '').toLowerCase()
  const sku = String(order.lineItems?.[0]?.sku || '').toLowerCase()
  const legacyItemId = String(order.lineItems?.[0]?.legacyItemId || '').toLowerCase()
  return [title, buyer, orderId, sku, legacyItemId].some((v) => v.includes(q))
}

function CompactOrdersList({
  orders,
  expandedId,
  onToggleExpanded,
}: {
  orders: EbayOrder[]
  expandedId: string | null
  onToggleExpanded: (orderId: string) => void
}) {
  if (orders.length === 0) return null

  return (
    <div className="pwa-orders__list">
      {orders.map((order) => {
        const fullTitle = order.lineItems?.[0]?.title || order.orderId
        const title = String(fullTitle).slice(0, 80) || order.orderId
        const total = parseFloat(order.pricingSummary?.total?.value || '0')
        const date = new Date(order.creationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const buyer = order.buyer?.username || 'Buyer'
        const status = getOrderDisplayStatus(order)
        const expanded = expandedId === order.orderId

        return (
          <button
            key={order.orderId}
            type="button"
            className={`pwa-order-row${expanded ? ' pwa-order-row--expanded' : ''}`}
            onClick={() => onToggleExpanded(order.orderId)}
          >
            <span className={dotClassForTone(status.tone)} aria-hidden />
            <span className="pwa-order-row__main">
              <span className="pwa-order-row__title">{title}</span>
              <span className="pwa-order-row__meta">
                {buyer} · {date} · <span className={`pwa-order-row__status pwa-order-row__status--${status.tone}`}>{status.label}</span>
              </span>
              {expanded ? (
                <span className="pwa-order-row__expand">
                  <span className="pwa-order-row__expand-line">{fullTitle}</span>
                  <span className="pwa-order-row__expand-meta">
                    Order ID <span className="pwa-order-row__mono">{order.orderId}</span>
                    {order.lineItems?.[0]?.legacyItemId ? (
                      <>
                        {' '}· Item <span className="pwa-order-row__mono">{String(order.lineItems[0].legacyItemId)}</span>
                      </>
                    ) : null}
                    {order.lineItems?.[0]?.sku ? (
                      <>
                        {' '}· SKU <span className="pwa-order-row__mono">{String(order.lineItems[0].sku)}</span>
                      </>
                    ) : null}
                  </span>
                </span>
              ) : null}
            </span>
            <span className="pwa-order-row__price">${total.toFixed(2)}</span>
          </button>
        )
      })}
    </div>
  )
}

export function OrdersTab({
  connected,
  orders,
  awaiting,
  grossRevenue,
  onOpenSettings,
  compact,
}: {
  connected: boolean
  orders: EbayOrder[]
  awaiting: EbayOrder[]
  grossRevenue: number
  onOpenSettings: () => void
  compact?: boolean
}) {
  const fulfilled = orders.filter(o => o.orderFulfillmentStatus !== 'NOT_STARTED')

  if (compact) {
    const needsShip = awaiting
    const history = orders
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<CompactOrdersFilter>('all')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const allFiltered = useMemo(() => {
      const withQuery = history.filter((o) => matchesQuery(o, query))
      if (filter === 'all') return withQuery
      if (filter === 'needs_ship') return withQuery.filter((o) => getOrderDisplayStatus(o).tone === 'red')
      if (filter === 'refunded') return withQuery.filter((o) => getOrderDisplayStatus(o).tone === 'blue')
      return withQuery.filter((o) => {
        const s = getOrderDisplayStatus(o)
        return s.tone === 'green' || s.tone === 'gold'
      })
    }, [filter, history, query])

    const shipFiltered = useMemo(() => {
      return needsShip.filter((o) => matchesQuery(o, query))
    }, [needsShip, query])

    const toggleExpanded = (orderId: string) => {
      setExpandedId((prev) => (prev === orderId ? null : orderId))
    }

    return (
      <div className="pwa-orders">
        <div className="pwa-orders__head">
          <div className="pwa-orders__eyebrow">Orders</div>
          <div className="pwa-orders__title">All orders</div>
          <div className="pwa-orders__sub">
            {!connected
              ? 'Connect eBay to load your order history.'
              : needsShip.length > 0
                ? `${needsShip.length} need to ship.`
                : 'You’re all caught up.'}
          </div>
        </div>

        {!connected ? (
          <div style={{ padding: '0 var(--xpad) 24px' }}>
            <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect eBay in Settings to load orders." style={{ background: '#fff', padding: '28px 18px' }} />
          </div>
        ) : (
          <>
            <div className="pwa-orders__stats">
              <div className="pwa-orders__stat">
                <div className="pwa-orders__stat-label">Needs to ship</div>
                <div className="pwa-orders__stat-value">{needsShip.length}</div>
              </div>
              <div className="pwa-orders__stat">
                <div className="pwa-orders__stat-label">Total</div>
                <div className="pwa-orders__stat-value">{orders.length}</div>
              </div>
              <div className="pwa-orders__stat">
                <div className="pwa-orders__stat-label">Revenue</div>
                <div className="pwa-orders__stat-value">${grossRevenue.toFixed(0)}</div>
              </div>
            </div>

            <div className="pwa-orders__tools">
              <div className="pwa-orders__search">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setExpandedId(null) }}
                  placeholder="Search title, buyer, SKU…"
                  inputMode="search"
                  className="pwa-orders__search-input"
                />
              </div>
              <div className="pwa-orders__chips" role="tablist" aria-label="Order filters">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'needs_ship', label: 'Needs ship' },
                  { id: 'fulfilled', label: 'Fulfilled' },
                  { id: 'refunded', label: 'Refunded' },
                ] as Array<{ id: CompactOrdersFilter; label: string }>).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pwa-orders__chip${filter === c.id ? ' is-active' : ''}`}
                    onClick={() => { setFilter(c.id); setExpandedId(null) }}
                    role="tab"
                    aria-selected={filter === c.id}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {connected && needsShip.length > 0 ? (
          <section className="pwa-orders__section">
            <div className="pwa-orders__section-head">
              <div className="pwa-orders__section-title">Needs to ship</div>
              <div className="pwa-orders__section-count">{shipFiltered.length}</div>
            </div>
            <CompactOrdersList orders={shipFiltered} expandedId={expandedId} onToggleExpanded={toggleExpanded} />
          </section>
        ) : null}

        {connected ? (
          <section className="pwa-orders__section">
            <div className="pwa-orders__section-head">
              <div className="pwa-orders__section-title">All orders</div>
              <div className="pwa-orders__section-count">{allFiltered.length}</div>
            </div>
            {history.length === 0 ? (
              <div className="pwa-empty-card">No orders yet — sync from the menu when you’re ready.</div>
            ) : allFiltered.length === 0 ? (
              <div className="pwa-empty-card">No matches.</div>
            ) : (
              <CompactOrdersList orders={allFiltered} expandedId={expandedId} onToggleExpanded={toggleExpanded} />
            )}
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>

      {/* Header */}
      <div style={{ padding: compact ? '22px var(--xpad) 18px' : '40px var(--xpad) 28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--plat)', marginBottom: '8px' }}>
          {compact ? 'Orders' : 'StackPilot / Orders'}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: compact ? '26px' : '36px', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.1, marginBottom: '10px' }}>
          {compact ? 'Your orders' : 'Order Management'}
        </div>
        <div style={{ fontSize: compact ? '12px' : '13px', color: 'var(--sil)', lineHeight: 1.6 }}>
          {!connected
            ? 'Connect your eBay account to start loading orders.'
            : awaiting.length > 0
              ? `${awaiting.length} order${awaiting.length > 1 ? 's' : ''} need${awaiting.length === 1 ? 's' : ''} to be shipped. Buy the item on Amazon and mark it shipped on eBay.`
              : orders.length > 0
                ? `All ${orders.length} orders are taken care of — great work!`
                : 'No orders loaded yet. Try syncing from the top bar.'}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '14px', padding: '0 var(--xpad) 28px' }}>
        <SummaryCard
          label="Need Action"
          value={awaiting.length.toString()}
          hint="Orders you still need to ship"
          tone={awaiting.length > 0 ? 'var(--red)' : 'var(--grn)'}
          pulse={awaiting.length > 0}
        />
        <SummaryCard
          label="Fulfilled"
          value={fulfilled.length.toString()}
          hint="Orders shipped or completed"
          tone="var(--grn)"
        />
        <SummaryCard
          label="Total Orders"
          value={orders.length.toString()}
          hint="All orders loaded from eBay"
          tone="var(--gold)"
        />
        <SummaryCard
          label="Gross Revenue"
          value={`$${grossRevenue.toFixed(0)}`}
          hint="Total sales value loaded"
          tone="var(--gld2)"
        />
      </div>

      {/* Needs attention */}
      {awaiting.length > 0 ? (
        <div style={{ margin: '0 var(--xpad) 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)', animation: 'glow-pulse 2s ease infinite' }} />
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--red)' }}>
              Needs to Ship ({awaiting.length})
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '12px', lineHeight: 1.5 }}>
            Buy these on Amazon and mark them shipped on eBay to keep your seller metrics healthy.
          </div>
          <OrderTable orders={awaiting} />
        </div>
      ) : connected && orders.length > 0 ? (
        <div style={{ margin: '0 var(--xpad) 28px', padding: '16px 20px', borderRadius: '14px', background: 'rgba(46,207,118,0.06)', border: '1px solid rgba(46,207,118,0.18)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>✅</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--grn)', marginBottom: '2px' }}>All caught up!</div>
            <div style={{ fontSize: '11px', color: 'var(--dim)' }}>No orders are waiting to ship right now.</div>
          </div>
        </div>
      ) : null}

      {/* All orders */}
      <div style={{ padding: '0 var(--xpad) 44px' }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--plat)' }}>
            All Orders ({orders.length})
          </div>
          <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '4px' }}>
            Complete history of every order loaded from eBay
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            connected={connected}
            onConnect={onOpenSettings}
            msg={connected ? 'No orders found yet. Hit Sync eBay in the top bar to load your latest orders.' : 'Connect eBay to start loading your order history.'}
          />
        ) : (
          <OrderTable orders={orders} />
        )}
      </div>

    </div>
  )
}

function SummaryCard({ label, value, hint, tone, pulse = false }: { label: string; value: string; hint: string; tone: string; pulse?: boolean }) {
  return (
    <div className="card" style={{ padding: '22px' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--sil)', marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        {pulse ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: tone, boxShadow: `0 0 8px ${tone}`, animation: 'glow-pulse 2s ease infinite', flexShrink: 0 }} /> : null}
        <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '32px', fontWeight: 800, color: tone, lineHeight: 1, letterSpacing: 0 }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.4 }}>{hint}</div>
    </div>
  )
}
