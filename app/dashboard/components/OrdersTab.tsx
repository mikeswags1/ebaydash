import type { EbayOrder } from '../types'
import { EmptyState, OrderTable } from './shared'

export function OrdersTab({
  connected,
  orders,
  awaiting,
  grossRevenue,
  onOpenSettings,
}: {
  connected: boolean
  orders: EbayOrder[]
  awaiting: EbayOrder[]
  grossRevenue: number
  onOpenSettings: () => void
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <div style={{ padding: '56px 52px 40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'var(--gold)', marginBottom: '14px', opacity: 0.85 }}>
            EbayDash / Live
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: 600, color: 'var(--txt)', lineHeight: 0.92, letterSpacing: '-0.015em', textShadow: '0 4px 80px rgba(200,162,80,0.18)' }}>
            Order Management
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Metric label="Need Action" value={awaiting.length.toString()} color={awaiting.length > 0 ? 'var(--red)' : 'var(--grn)'} />
          <Metric label="Gross Revenue" value={`$${grossRevenue.toFixed(0)}`} color="var(--gld2)" />
        </div>
      </div>

      {awaiting.length > 0 ? (
        <div style={{ margin: '0 44px 24px' }}>
          <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} />
            Awaiting Shipment ({awaiting.length})
          </div>
          <OrderTable orders={awaiting} />
        </div>
      ) : null}

      <div style={{ padding: '0 44px 44px' }}>
        <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '14px' }}>
          All Orders ({orders.length})
        </div>
        {orders.length === 0 ? (
          <EmptyState connected={connected} onConnect={onOpenSettings} msg={connected ? 'No orders found yet. Try syncing again in a few minutes.' : 'Connect eBay to start loading orders.'} />
        ) : (
          <OrderTable orders={orders} />
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '42px', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginTop: '6px' }}>{label}</div>
    </div>
  )
}
