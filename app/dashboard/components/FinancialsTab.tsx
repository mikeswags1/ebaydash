import type { FinancialItem, FinancialSummary } from '../types'
import { EmptyState, SectionIntro } from './shared'

export function FinancialsTab({
  connected,
  loading,
  error,
  summary,
  items,
  onRefresh,
  onOpenSettings,
}: {
  connected: boolean
  loading: boolean
  error: string | null
  summary: FinancialSummary | null
  items: FinancialItem[]
  onRefresh: () => void
  onOpenSettings: () => void
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro
        eyebrow="EbayDash / Analytics"
        title="Financials"
        subtitle="Profitability is calculated from net order revenue after refunds, stored Amazon source cost, and eBay fees. Amazon shipping is treated as $0."
      />

      {!connected ? (
        <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect eBay to load real profitability data." style={{ margin: '0 44px 44px' }} />
      ) : null}

      {connected && loading ? (
        <div className="card" style={{ margin: '0 44px 44px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--dim)' }}>Loading financial data...</div>
        </div>
      ) : null}

      {connected && error ? (
        <div className="card" style={{ margin: '0 44px 24px', padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>
          <button onClick={onRefresh} className="btn btn-gold btn-sm">
            Retry
          </button>
        </div>
      ) : null}

      {connected && summary ? (
        <>
          {summary.missingCostItems > 0 ? (
            <div style={{ margin: '0 44px 24px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(200,162,80,0.08)', border: '1px solid rgba(200,162,80,0.18)', color: 'var(--sil)', fontSize: '12px', lineHeight: 1.7 }}>
              {summary.missingCostItems} sold item{summary.missingCostItems === 1 ? '' : 's'} are missing stored Amazon source cost.
              Profit, ROI, and margin totals only include tracked items with saved cost data. This gap existed because older listings did not persist Amazon cost at listing time; new listings now do.
            </div>
          ) : null}

          {summary.refundedItems ? (
            <div style={{ margin: '0 44px 24px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(82,151,255,0.08)', border: '1px solid rgba(82,151,255,0.20)', color: 'var(--sil)', fontSize: '12px', lineHeight: 1.7 }}>
              {summary.refundedItems} item{summary.refundedItems === 1 ? '' : 's'} include refund activity.
              Financial totals use net revenue after ${summary.refundedRevenue?.toFixed(2) || '0.00'} in refunds.
            </div>
          ) : null}

          {summary.estimatedFeeItems ? (
            <div style={{ margin: '0 44px 24px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(90,80,55,0.10)', border: '1px solid rgba(90,80,55,0.20)', color: 'var(--sil)', fontSize: '12px', lineHeight: 1.7 }}>
              eBay fees are actual for {summary.actualFeeItems || 0} item{summary.actualFeeItems === 1 ? '' : 's'} and estimated for {summary.estimatedFeeItems} item{summary.estimatedFeeItems === 1 ? '' : 's'}.
              {summary.financeApiAvailable
                ? ' Some matching fee records were not returned for these orders, so saved fee rates filled the gaps.'
                : ' Reconnect eBay in Settings to grant Finances access, then refresh this tab for actual fee data.'}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px', padding: '0 44px 24px' }}>
            <MetricCard label="Net Revenue" value={`$${summary.grossRevenue.toFixed(2)}`} tone="var(--gld2)" />
            <MetricCard label="Refunds" value={`$${(summary.refundedRevenue || 0).toFixed(2)}`} tone={summary.refundedRevenue ? '#74a9ff' : 'var(--dim)'} />
            <MetricCard label="Amazon Cost" value={`$${summary.amazonCost.toFixed(2)}`} tone="var(--txt)" />
            <MetricCard label="eBay Fees" value={`$${summary.ebayFees.toFixed(2)}`} tone="var(--dim)" />
            <MetricCard label="Net Profit" value={`$${summary.profit.toFixed(2)}`} tone={summary.profit >= 0 ? 'var(--grn)' : 'var(--red)'} />
            <MetricCard label="ROI" value={`${summary.roi.toFixed(1)}%`} tone={summary.roi >= 0 ? 'var(--grn)' : 'var(--red)'} />
            <MetricCard label="Margin" value={`${summary.margin.toFixed(1)}%`} tone={summary.margin >= 0 ? 'var(--gold)' : 'var(--red)'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '20px', padding: '0 44px 24px' }}>
            <SummaryCard
              title="Coverage"
              rows={[
                { label: 'Sold Items', value: summary.soldItems.toString() },
                { label: 'Refunded Items', value: String(summary.refundedItems || 0) },
                { label: 'Tracked Items', value: summary.trackedItems.toString() },
                { label: 'Missing Cost Items', value: summary.missingCostItems.toString() },
                { label: 'Actual Fee Items', value: String(summary.actualFeeItems || 0) },
                { label: 'Finance API', value: summary.financeApiAvailable ? 'Available' : 'Reconnect' },
              ]}
            />
            <SummaryCard
              title="Tracked Totals"
              rows={[
                { label: 'Gross Sales', value: `$${(summary.grossSalesRevenue || summary.grossRevenue).toFixed(2)}` },
                { label: 'Refunds', value: `$${(summary.refundedRevenue || 0).toFixed(2)}` },
                { label: 'Tracked Revenue', value: `$${summary.trackedRevenue.toFixed(2)}` },
                { label: 'Amazon Shipping', value: '$0.00' },
                { label: 'Formula', value: 'Net Revenue - Cost - Fees' },
              ]}
            />
          </div>

          <div style={{ padding: '0 44px 44px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)' }}>
                Sold Line Items ({items.length})
              </div>
              <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                Refresh Financials
              </button>
            </div>
            {items.length === 0 ? (
              <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--dim)' }}>No sold order lines were available yet.</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
                      {['Item', 'Revenue', 'Refund', 'Amazon Cost', 'Fees', 'Profit', 'ROI', 'Margin', 'Sold'].map((heading) => (
                        <th key={heading} style={{ color: 'rgba(100,86,58,0.95)', fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '12px 14px', textAlign: heading === 'Item' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} style={{ background: index % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)', borderBottom: '1px solid rgba(195,158,88,0.06)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: '300px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--dim)', marginTop: '2px' }}>
                            {item.asin || 'Unmapped'} {item.listingId ? `/ #${item.listingId}` : ''}
                          </div>
                        </td>
                        <td style={cellStyle('var(--gld2)')}>${item.ebayRevenue.toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <RefundBadge status={item.refundStatus || 'none'} amount={item.refundedAmount || 0} />
                        </td>
                        <td style={cellStyle(item.amazonCost === null ? 'var(--red)' : 'var(--txt)')}>{item.amazonCost === null ? 'Missing' : `$${item.amazonCost.toFixed(2)}`}</td>
                        <td style={cellStyle(item.feeSource === 'actual' ? 'var(--txt)' : 'var(--dim)')}>
                          <div>${item.ebayFees.toFixed(2)}</div>
                          <div style={{ fontFamily: 'inherit', fontSize: '8px', color: 'var(--dim)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                            {item.feeSource === 'actual' ? 'Actual' : 'Est.'}
                          </div>
                        </td>
                        <td style={cellStyle(item.profit !== null && item.profit >= 0 ? 'var(--grn)' : 'var(--red)')}>{item.profit === null ? 'Missing' : `$${item.profit.toFixed(2)}`}</td>
                        <td style={cellStyle(item.roi !== null && item.roi >= 0 ? 'var(--grn)' : 'var(--red)')}>{item.roi === null ? 'Missing' : `${item.roi.toFixed(1)}%`}</td>
                        <td style={cellStyle(item.margin !== null && item.margin >= 0 ? 'var(--gold)' : 'var(--red)')}>{item.margin === null ? 'Missing' : `${item.margin.toFixed(1)}%`}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', color: 'var(--dim)' }}>{new Date(item.soldAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card" style={{ padding: '26px 24px' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '14px' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '34px', fontWeight: 800, color: tone, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
    </div>
  )
}

function SummaryCard({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="card" style={{ padding: '28px' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--plat)', marginBottom: '20px' }}>{title}</div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(195,158,88,0.08)' }}>
          <span style={{ fontSize: '13px', color: 'var(--sil)' }}>{row.label}</span>
          <span style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '14px' }}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function RefundBadge({ status, amount }: { status: 'none' | 'partial' | 'full' | 'pending'; amount: number }) {
  if (status === 'none' && amount <= 0) {
    return <span style={{ fontSize: '10px', color: 'var(--dim)' }}>-</span>
  }

  const label = status === 'full' ? 'Refunded' : status === 'partial' ? 'Partial' : 'Pending'
  const tone = status === 'full' ? '#74a9ff' : 'var(--gold)'
  const background = status === 'full' ? 'rgba(82,151,255,0.12)' : 'rgba(200,162,80,0.10)'
  const border = status === 'full' ? 'rgba(82,151,255,0.28)' : 'rgba(200,162,80,0.25)'

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
      <span style={{ fontSize: '8px', padding: '2px 8px', borderRadius: '20px', fontWeight: 800, background, color: tone, border: `1px solid ${border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '10px', fontWeight: 700, color: tone }}>
        -${amount.toFixed(2)}
      </span>
    </div>
  )
}

function cellStyle(color: string) {
  return {
    padding: '12px 14px',
    textAlign: 'center' as const,
    fontFamily: 'Space Grotesk,sans-serif',
    fontWeight: 700,
    fontSize: '12px',
    color,
  }
}
