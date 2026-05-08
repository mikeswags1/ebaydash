import type { CSSProperties } from 'react'
import type { EbayOrder } from '../types'
import { getOrderBadgeColors, getOrderDisplayStatus } from '../order-status'

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
    <div className="dashboard-section" style={{ padding: '56px 52px 40px' }}>
      <div
        className="dashboard-title"
        style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0,
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
          fontSize: '64px',
          fontWeight: 600,
          color: 'var(--txt)',
          lineHeight: 1,
          letterSpacing: 0,
          textShadow: '0 10px 40px rgba(14,116,144,0.10)',
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
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: 'rgba(8,17,31,0.88)' }}>
            {['Item', 'Buyer', 'Total', 'Status', 'Date'].map((heading) => (
              <th
                key={heading}
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                  background: 'rgba(8,17,31,0.88)',
                  color: 'var(--plat)',
                  fontSize: '8px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '12px 16px',
                  textAlign: heading === 'Item' ? 'left' : 'center',
                  borderBottom: '1px solid rgba(125,211,252,0.10)',
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const status = getOrderDisplayStatus(order)
            const badge = getOrderBadgeColors(status.tone)

            return (
              <tr
                key={order.orderId}
                style={{
                  background: index % 2 === 0 ? 'rgba(14,27,44,0.86)' : 'rgba(12,24,40,0.86)',
                  transition: 'background 0.15s',
                }}
              >
                <td style={{ padding: '14px 16px', color: 'var(--txt)', fontSize: '13px', maxWidth: '340px', borderBottom: '1px solid rgba(125,211,252,0.06)' }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.lineItems?.[0]?.title || order.orderId}
                  </div>
                  <div style={{ marginTop: '3px', fontSize: '10px', color: 'var(--dim)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                    {order.orderId}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '12px', textAlign: 'center', borderBottom: '1px solid rgba(125,211,252,0.06)' }}>
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
                    borderBottom: '1px solid rgba(125,211,252,0.06)',
                  }}
                >
                  ${parseFloat(order.pricingSummary?.total?.value || '0').toFixed(2)}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(125,211,252,0.06)' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      background: badge.background,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {status.label}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: 'var(--dim)', fontSize: '11px', textAlign: 'center', borderBottom: '1px solid rgba(125,211,252,0.06)' }}>
                  {new Date(order.creationDate).toLocaleDateString()}
                </td>
              </tr>
            )
          })}
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
                background: 'linear-gradient(90deg,transparent,rgba(14,116,144,0.14),transparent)',
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
        background: 'rgba(14,27,44,0.74)',
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
