import type { EbayOrder } from '../types'
import { getOrderDisplayStatus } from '../order-status'

export function OverviewTab({
  connected,
  orders,
  awaitingCount,
  onOpenSettings,
}: {
  connected: boolean
  orders: EbayOrder[]
  awaitingCount: number
  grossRevenue: number // kept in type for prop compatibility
  onOpenSettings: () => void
}) {
  const recentOrders = orders.slice(0, 5)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>

      {/* Header */}
      <div style={{ padding: '40px 44px 32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '8px' }}>
          EbayDash / Operations
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '38px', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.1, marginBottom: '10px' }}>
          {greeting} 👋
        </div>
        <div style={{ fontSize: '14px', color: 'var(--sil)', lineHeight: 1.6 }}>
          {connected
            ? awaitingCount > 0
              ? `You have ${awaitingCount} order${awaitingCount > 1 ? 's' : ''} waiting to be shipped. Take care of those first.`
              : `You're all caught up — no orders waiting to ship. Keep listing!`
            : `Connect your eBay account below to start tracking orders and revenue.`}
        </div>
      </div>

      {/* Connect prompt */}
      {!connected ? (
        <div style={{ margin: '0 44px 32px', padding: '28px 32px', borderRadius: '18px', background: 'rgba(200,162,80,0.06)', border: '1px solid rgba(200,162,80,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '5px' }}>
              Connect your eBay account to get started
            </div>
            <div style={{ fontSize: '12px', color: 'var(--sil)', lineHeight: 1.5 }}>
              Once connected, your orders, revenue, and listings will appear here automatically.
            </div>
          </div>
          <button onClick={onOpenSettings} className="btn btn-gold" style={{ whiteSpace: 'nowrap' }}>
            Connect eBay
          </button>
        </div>
      ) : null}

      {/* Needs attention banner */}
      {connected && awaitingCount > 0 ? (
        <div style={{ margin: '0 44px 28px', padding: '16px 20px', borderRadius: '14px', background: 'rgba(232,63,80,0.07)', border: '1px solid rgba(232,63,80,0.22)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0, boxShadow: '0 0 8px var(--red)' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red)', marginBottom: '2px' }}>
              {awaitingCount} order{awaitingCount > 1 ? 's' : ''} need{awaitingCount === 1 ? 's' : ''} to ship
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sil)' }}>
              Head to the Orders tab to see buyer details and mark them shipped.
            </div>
          </div>
        </div>
      ) : null}

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '16px', padding: '0 44px 32px' }}>
        <MetricCard
          label="Needs to Ship"
          value={awaitingCount.toString()}
          hint={awaitingCount > 0 ? 'Orders waiting on you' : 'All caught up!'}
          tone={awaitingCount > 0 ? 'var(--red)' : 'var(--grn)'}
          pulse={awaitingCount > 0}
        />
        <MetricCard
          label="Total Orders"
          value={orders.length.toString()}
          hint="Orders loaded from eBay"
          tone="var(--gold)"
        />
        <MetricCard
          label="eBay Connection"
          value={connected ? 'Live' : 'Offline'}
          hint={connected ? 'Syncing normally' : 'Go to Settings to connect'}
          tone={connected ? 'var(--grn)' : 'var(--dim)'}
        />
      </div>

      {/* Recent orders */}
      {connected && recentOrders.length > 0 ? (
        <div style={{ padding: '0 44px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--dim)' }}>
                Recent Orders
              </div>
              <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '3px' }}>
                Your 5 most recent sales
              </div>
            </div>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {recentOrders.map((order, i) => {
              const title = order.lineItems?.[0]?.title?.slice(0, 58) || order.orderId
              const total = parseFloat(order.pricingSummary?.total?.value || '0')
              const date = new Date(order.creationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const status = getOrderDisplayStatus(order)
              const dotColor = status.tone === 'red' ? 'var(--red)' : status.tone === 'blue' ? '#74a9ff' : status.tone === 'gold' ? 'var(--gold)' : 'rgba(46,207,118,0.7)'
              const labelColor = status.tone === 'red' ? 'var(--red)' : status.tone === 'blue' ? '#74a9ff' : status.tone === 'gold' ? 'var(--gold)' : 'var(--grn)'

              return (
                <div
                  key={order.orderId}
                  style={{
                    padding: '16px 24px',
                    borderBottom: i < recentOrders.length - 1 ? '1px solid rgba(195,158,88,0.07)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '2px' }}>
                        {order.buyer?.username} · {date}
                        <span style={{ color: labelColor, marginLeft: '8px', fontWeight: 600 }}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '14px', flexShrink: 0 }}>
                    ${total.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : connected && orders.length === 0 ? (
        <div style={{ padding: '0 44px 44px' }}>
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛒</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt)', marginBottom: '6px' }}>No orders yet</div>
            <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.6 }}>
              Once buyers purchase your listings, orders will appear here automatically.
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}

function MetricCard({ label, value, hint, tone, pulse = false }: { label: string; value: string; hint: string; tone: string; pulse?: boolean }) {
  return (
    <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '12px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        {pulse ? <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: tone, boxShadow: `0 0 8px ${tone}`, animation: 'glow-pulse 2s ease infinite', flexShrink: 0 }} /> : null}
        <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '36px', fontWeight: 800, color: tone, lineHeight: 1, letterSpacing: '-0.04em' }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.4 }}>{hint}</div>
    </div>
  )
}
