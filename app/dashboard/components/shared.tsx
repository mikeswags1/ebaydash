import type { CSSProperties } from 'react'
import type { EbayOrder } from '../types'

export function SectionIntro({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div style={{ padding: '56px 52px 40px' }}>
      <div
        style={{
          fontSize: '8px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.32em',
          color: 'var(--gold)',
          marginBottom: '14px',
          opacity: 0.85,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 'clamp(34px, 6vw, 68px)',
          fontWeight: 600,
          color: 'var(--txt)',
          lineHeight: 0.92,
          letterSpacing: '-0.015em',
          textShadow: '0 4px 80px rgba(200,162,80,0.18)',
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--dim)', lineHeight: 1.6 }}>{subtitle}</div>
      ) : null}
    </div>
  )
}

export function OrderTable({ orders }: { orders: EbayOrder[] }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
            {['Item', 'Buyer', 'Total', 'Status', 'Date'].map((heading) => (
              <th
                key={heading}
                style={{
                  color: 'rgba(100,86,58,0.95)',
                  fontSize: '7.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  padding: '13px 16px',
                  textAlign: heading === 'Item' ? 'left' : 'center',
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => (
            <tr
              key={order.orderId}
              style={{
                background: index % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)',
                borderBottom: '1px solid rgba(195,158,88,0.06)',
                transition: 'background 0.15s',
              }}
            >
              <td style={{ padding: '14px 16px', color: 'var(--txt)', fontSize: '13px', maxWidth: '300px' }}>
                {order.lineItems?.[0]?.title?.slice(0, 55) || order.orderId}
                {(order.lineItems?.[0]?.title?.length || 0) > 55 ? '...' : ''}
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '12px', textAlign: 'center' }}>
                {order.buyer?.username}
              </td>
              <td
                style={{
                  padding: '14px 16px',
                  fontFamily: 'Space Grotesk,sans-serif',
                  fontWeight: 700,
                  color: 'var(--gld2)',
                  fontSize: '13px',
                  textAlign: 'center',
                }}
              >
                ${parseFloat(order.pricingSummary?.total?.value || '0').toFixed(2)}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '8px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    background:
                      order.orderFulfillmentStatus === 'NOT_STARTED'
                        ? 'rgba(232,63,80,0.12)'
                        : 'rgba(46,207,118,0.10)',
                    color: order.orderFulfillmentStatus === 'NOT_STARTED' ? 'var(--red)' : 'var(--grn)',
                    border: `1px solid ${
                      order.orderFulfillmentStatus === 'NOT_STARTED'
                        ? 'rgba(232,63,80,0.25)'
                        : 'rgba(46,207,118,0.22)'
                    }`,
                  }}
                >
                  {order.orderFulfillmentStatus === 'NOT_STARTED' ? 'Ship Now' : 'Fulfilled'}
                </span>
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--dim)', fontSize: '11px', textAlign: 'center' }}>
                {new Date(order.creationDate).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FinCard({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <div className="card" style={{ padding: '32px' }}>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--plat)',
          marginBottom: '24px',
        }}
      >
        {title}
      </div>
      {rows.map((row, index) => (
        <div key={row.label}>
          {index > 0 ? (
            <div
              style={{
                height: '1px',
                background: 'linear-gradient(90deg,transparent,rgba(200,162,80,0.14),transparent)',
                margin: '8px 0',
              }}
            />
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: '13px', color: 'var(--sil)' }}>{row.label}</span>
            <span
              style={{
                fontFamily: 'Space Grotesk,sans-serif',
                fontWeight: 700,
                color: 'var(--gld2)',
                fontSize: '14px',
              }}
            >
              {row.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  connected,
  onConnect,
  msg,
  style,
}: {
  connected: boolean
  onConnect: () => void
  msg: string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        padding: '60px',
        textAlign: 'center',
        borderRadius: '20px',
        border: '1px solid var(--bdr)',
        background: 'rgba(14,10,5,0.5)',
        ...style,
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: connected ? 0 : '16px' }}>{msg}</div>
      {!connected ? (
        <button onClick={onConnect} className="btn btn-gold btn-sm">
          Open Settings
        </button>
      ) : null}
    </div>
  )
}
