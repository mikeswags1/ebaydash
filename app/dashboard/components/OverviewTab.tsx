import { SectionIntro } from './shared'
import type { EbayOrder } from '../types'

export function OverviewTab({
  connected,
  orders,
  awaitingCount,
  grossRevenue,
  onOpenSettings,
}: {
  connected: boolean
  orders: EbayOrder[]
  awaitingCount: number
  grossRevenue: number
  onOpenSettings: () => void
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="EbayDash / Operations" title="Overview" />

      {!connected ? (
        <div
          style={{
            margin: '0 44px 32px',
            padding: '28px 32px',
            borderRadius: '18px',
            background: 'rgba(200,162,80,0.05)',
            border: '1px solid rgba(200,162,80,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)', marginBottom: '6px' }}>
              Connect your eBay account
            </div>
            <div style={{ fontSize: '13px', color: 'var(--sil)' }}>Add your eBay connection to start syncing orders and account data.</div>
          </div>
          <button onClick={onOpenSettings} className="btn btn-gold">
            Open Settings
          </button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '16px', padding: '0 44px 36px' }}>
        {[
          { label: 'Awaiting Shipment', value: awaitingCount.toString(), color: awaitingCount > 0 ? 'var(--red)' : 'var(--grn)' },
          { label: 'Total Orders', value: orders.length.toString(), color: 'var(--gold)' },
          { label: 'Gross Revenue', value: `$${grossRevenue.toFixed(0)}`, color: 'var(--gld2)' },
          { label: 'eBay Status', value: connected ? 'Live' : 'Offline', color: connected ? 'var(--grn)' : 'var(--dim)' },
        ].map((metric) => (
          <div key={metric.label} className="card" style={{ padding: '26px 24px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '14px' }}>
              {metric.label}
            </div>
            <div
              style={{
                fontFamily: 'Space Grotesk,sans-serif',
                fontSize: '36px',
                fontWeight: 800,
                color: metric.color,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {orders.length > 0 ? (
        <div style={{ padding: '0 44px 44px' }}>
          <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '16px' }}>
            Recent Orders
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {orders.slice(0, 5).map((order, index) => (
              <div
                key={order.orderId}
                style={{
                  padding: '16px 24px',
                  borderBottom: index < 4 ? '1px solid rgba(195,158,88,0.07)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--txt)', marginBottom: '3px' }}>{order.lineItems?.[0]?.title?.slice(0, 60) || order.orderId}</div>
                  <div style={{ fontSize: '11px', color: 'var(--dim)' }}>
                    {order.buyer?.username} / {new Date(order.creationDate).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '14px', flexShrink: 0 }}>
                  ${parseFloat(order.pricingSummary?.total?.value || '0').toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
