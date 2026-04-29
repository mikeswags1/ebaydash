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
  const fulfilled = orders.filter(o => o.orderFulfillmentStatus !== 'NOT_STARTED')

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>

      {/* Header */}
      <div style={{ padding: '40px 44px 28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--plat)', marginBottom: '8px' }}>
          StackPilot / Orders
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '36px', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.1, marginBottom: '10px' }}>
          Order Management
        </div>
        <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.6 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '14px', padding: '0 44px 28px' }}>
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
        <div style={{ margin: '0 44px 28px' }}>
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
        <div style={{ margin: '0 44px 28px', padding: '16px 20px', borderRadius: '14px', background: 'rgba(46,207,118,0.06)', border: '1px solid rgba(46,207,118,0.18)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>✅</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--grn)', marginBottom: '2px' }}>All caught up!</div>
            <div style={{ fontSize: '11px', color: 'var(--dim)' }}>No orders are waiting to ship right now.</div>
          </div>
        </div>
      ) : null}

      {/* All orders */}
      <div style={{ padding: '0 44px 44px' }}>
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
