import type { FinancialItem, FinancialSummary } from '../types'
import { EmptyState } from './shared'

const PERIODS = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m',  label: '6 Months' },
  { value: '1y',  label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

export function FinancialsTab({
  connected,
  loading,
  error,
  summary,
  items,
  period,
  onPeriodChange,
  onRefresh,
  onOpenSettings,
}: {
  connected: boolean
  loading: boolean
  error: string | null
  summary: FinancialSummary | null
  items: FinancialItem[]
  period: string
  onPeriodChange: (p: string) => void
  onRefresh: () => void
  onOpenSettings: () => void
}) {
  const periodLabel = PERIODS.find(p => p.value === period)?.label || period

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>

      {/* Header */}
      <div style={{ padding: '40px 44px 24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '8px' }}>
          StackPilot / Analytics
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '36px', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.1, marginBottom: '10px' }}>
          Financials
        </div>
        <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.6 }}>
          {connected
            ? `Your real profit after Amazon cost and eBay fees — ${periodLabel.toLowerCase()}.`
            : 'Connect your eBay account to see your real profit numbers.'}
        </div>
      </div>

      {!connected ? (
        <div style={{ padding: '0 44px 44px' }}>
          <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect eBay to load your real profitability data." />
        </div>
      ) : null}

      {/* Period selector */}
      {connected ? (
        <div style={{ padding: '0 44px 28px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              style={{
                fontSize: '11px',
                fontWeight: period === p.value ? 700 : 500,
                padding: '7px 16px',
                borderRadius: '22px',
                border: period === p.value ? '1px solid rgba(200,162,80,0.55)' : '1px solid rgba(195,158,88,0.14)',
                background: period === p.value ? 'rgba(200,162,80,0.14)' : 'transparent',
                color: period === p.value ? 'var(--gld2)' : 'var(--dim)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      {connected && loading ? (
        <div className="card" style={{ margin: '0 44px 44px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--dim)' }}>Loading your financials...</div>
        </div>
      ) : null}

      {connected && error ? (
        <div className="card" style={{ margin: '0 44px 24px', padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>
          <button onClick={onRefresh} className="btn btn-gold btn-sm">Retry</button>
        </div>
      ) : null}

      {connected && summary ? (
        <>
          {/* Hero — Net Profit front and center */}
          <div style={{ padding: '0 44px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <HeroCard
                label="Net Profit"
                value={`$${summary.profit.toFixed(2)}`}
                hint={`What you actually kept after all costs — ${periodLabel}`}
                tone={summary.profit >= 0 ? 'var(--grn)' : 'var(--red)'}
                large
              />
              <HeroCard
                label="ROI"
                value={`${summary.roi.toFixed(1)}%`}
                hint="Return on your Amazon spend"
                tone={summary.roi >= 30 ? 'var(--grn)' : summary.roi >= 0 ? 'var(--gold)' : 'var(--red)'}
                large
              />
              <HeroCard
                label="Margin"
                value={`${summary.margin.toFixed(1)}%`}
                hint="Profit as % of revenue"
                tone={summary.margin >= 20 ? 'var(--grn)' : summary.margin >= 0 ? 'var(--gold)' : 'var(--red)'}
                large
              />
            </div>
          </div>

          {/* Money flow breakdown */}
          <div style={{ padding: '0 44px 28px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--dim)', marginBottom: '14px' }}>
              Where Your Money Went
            </div>
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr', alignItems: 'center', gap: '12px' }}>
                <FlowBlock label="eBay Revenue" value={`$${summary.grossRevenue.toFixed(2)}`} tone="var(--gld2)" hint="What buyers paid you" />
                <Arrow minus />
                <FlowBlock label="Amazon Cost" value={`$${summary.amazonCost.toFixed(2)}`} tone="var(--txt)" hint="What you paid to source" />
                <Arrow minus />
                <FlowBlock label="eBay Fees" value={`$${summary.ebayFees.toFixed(2)}`} tone="var(--dim)" hint="eBay's cut (~13%)" />
                <Arrow equals />
                <FlowBlock
                  label="Your Profit"
                  value={`$${summary.profit.toFixed(2)}`}
                  tone={summary.profit >= 0 ? 'var(--grn)' : 'var(--red)'}
                  hint="Money in your pocket"
                  bold
                />
              </div>

              {/* Visual profit bar */}
              {summary.grossRevenue > 0 ? (
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(195,158,88,0.08)', paddingTop: '20px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '8px' }}>Revenue breakdown</div>
                  <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
                    <div style={{ flex: summary.amazonCost / summary.grossRevenue, background: 'rgba(150,140,120,0.4)', borderRadius: '4px 0 0 4px', minWidth: summary.amazonCost > 0 ? '4px' : 0 }} title="Amazon Cost" />
                    <div style={{ flex: summary.ebayFees / summary.grossRevenue, background: 'rgba(150,140,120,0.25)', minWidth: summary.ebayFees > 0 ? '4px' : 0 }} title="eBay Fees" />
                    <div style={{ flex: Math.max(0, summary.profit) / summary.grossRevenue, background: summary.profit >= 0 ? 'rgba(46,207,118,0.55)' : 'rgba(232,63,80,0.55)', borderRadius: '0 4px 4px 0', minWidth: summary.profit > 0 ? '4px' : 0 }} title="Profit" />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    {[
                      { label: 'Amazon Cost', color: 'rgba(150,140,120,0.7)', pct: (summary.amazonCost / summary.grossRevenue * 100).toFixed(0) },
                      { label: 'eBay Fees', color: 'rgba(150,140,120,0.45)', pct: (summary.ebayFees / summary.grossRevenue * 100).toFixed(0) },
                      { label: 'Your Profit', color: summary.profit >= 0 ? 'var(--grn)' : 'var(--red)', pct: (Math.abs(summary.profit) / summary.grossRevenue * 100).toFixed(0) },
                    ].map(b => (
                      <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: b.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', color: 'var(--dim)' }}>{b.label} {b.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Secondary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '14px', padding: '0 44px 28px' }}>
            <StatCard label="Items Sold" value={summary.soldItems.toString()} hint="Total line items" />
            <StatCard label="Tracked" value={summary.trackedItems.toString()} hint="Items with cost data" />
            {summary.refundedItems ? <StatCard label="Refunded" value={String(summary.refundedItems)} hint={`$${(summary.refundedRevenue || 0).toFixed(2)} back to buyers`} tone="#74a9ff" /> : null}
            {summary.missingCostItems > 0 ? <StatCard label="Missing Cost" value={String(summary.missingCostItems)} hint="No Amazon cost saved" tone="var(--gold)" /> : null}
          </div>

          {/* Alerts */}
          {(summary.missingCostItems > 0 || summary.refundedItems) ? (
            <div style={{ padding: '0 44px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {summary.missingCostItems > 0 ? (
                <InfoBanner tone="gold" text={`${summary.missingCostItems} item${summary.missingCostItems > 1 ? 's are' : ' is'} missing Amazon cost — profit totals only count items where we have your cost saved. New listings save this automatically.`} />
              ) : null}
              {summary.refundedItems ? (
                <InfoBanner tone="blue" text={`${summary.refundedItems} item${summary.refundedItems > 1 ? 's' : ''} had refunds totalling $${(summary.refundedRevenue || 0).toFixed(2)}. Revenue shown is net after refunds.`} />
              ) : null}
            </div>
          ) : null}

          {/* Sold items table */}
          <div style={{ padding: '0 44px 44px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--dim)' }}>
                  Every Sale — {periodLabel}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '4px' }}>
                  {items.length} line item{items.length !== 1 ? 's' : ''} — profit per product after all costs
                </div>
              </div>
              <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>Refresh</button>
            </div>

            {items.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', marginBottom: '10px' }}>💰</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt)', marginBottom: '6px' }}>No sales yet for this period</div>
                <div style={{ fontSize: '12px', color: 'var(--dim)' }}>Try a wider time range or sync your eBay orders.</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
                      {[
                        { label: 'Item', left: true },
                        { label: 'Sale Price', left: false },
                        { label: 'Amazon Cost', left: false },
                        { label: 'eBay Fees', left: false },
                        { label: 'Profit', left: false },
                        { label: 'ROI', left: false },
                        { label: 'Date', left: false },
                      ].map(h => (
                        <th key={h.label} style={{ color: 'rgba(100,86,58,0.95)', fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '12px 14px', textAlign: h.left ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id} style={{ background: i % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)', borderBottom: '1px solid rgba(195,158,88,0.06)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--dim)', marginTop: '2px' }}>
                            {item.asin || '—'}
                            {item.refundStatus && item.refundStatus !== 'none' ? (
                              <span style={{ marginLeft: '6px', color: '#74a9ff', fontFamily: 'inherit', fontSize: '9px', fontWeight: 600 }}>
                                {item.refundStatus === 'full' ? 'Refunded' : item.refundStatus === 'partial' ? 'Partial Refund' : 'Refund Pending'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td style={tc('var(--gld2)')}>${item.ebayRevenue.toFixed(2)}</td>
                        <td style={tc(item.amazonCost === null ? 'var(--gold)' : 'var(--txt)')}>
                          {item.amazonCost === null ? '—' : `$${item.amazonCost.toFixed(2)}`}
                        </td>
                        <td style={tc('var(--dim)')}>
                          <div>${item.ebayFees.toFixed(2)}</div>
                          <div style={{ fontSize: '8px', color: 'rgba(120,110,80,0.7)', marginTop: '1px' }}>{item.feeSource === 'actual' ? 'actual' : 'est.'}</div>
                        </td>
                        <td style={tc(item.profit !== null && item.profit >= 0 ? 'var(--grn)' : 'var(--red)')}>
                          {item.profit === null ? '—' : `$${item.profit.toFixed(2)}`}
                        </td>
                        <td style={tc(item.roi !== null && item.roi >= 30 ? 'var(--grn)' : item.roi !== null && item.roi >= 0 ? 'var(--gold)' : 'var(--red)')}>
                          {item.roi === null ? '—' : `${item.roi.toFixed(0)}%`}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', color: 'var(--dim)' }}>
                          {new Date(item.soldAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
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

function HeroCard({ label, value, hint, tone, large }: { label: string; value: string; hint: string; tone: string; large?: boolean }) {
  return (
    <div className="card" style={{ padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${tone}, transparent)` }} />
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--dim)', marginBottom: '14px' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: large ? '40px' : '32px', fontWeight: 800, color: tone, lineHeight: 1, letterSpacing: '-0.04em', marginBottom: '10px' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.4 }}>{hint}</div>
    </div>
  )
}

function FlowBlock({ label, value, tone, hint, bold }: { label: string; value: string; tone: string; hint: string; bold?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--dim)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: bold ? '28px' : '22px', fontWeight: 800, color: tone, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--dim)' }}>{hint}</div>
    </div>
  )
}

function Arrow({ minus, equals }: { minus?: boolean; equals?: boolean }) {
  return (
    <div style={{ fontSize: '18px', color: 'rgba(195,158,88,0.3)', fontWeight: 300, textAlign: 'center', userSelect: 'none' }}>
      {minus ? '−' : equals ? '=' : '+'}
    </div>
  )
}

function StatCard({ label, value, hint, tone = 'var(--txt)' }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '26px', fontWeight: 800, color: tone, lineHeight: 1, marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--dim)' }}>{hint}</div>
    </div>
  )
}

function InfoBanner({ tone, text }: { tone: 'gold' | 'blue' | 'dim'; text: string }) {
  const styles = {
    gold: { bg: 'rgba(200,162,80,0.07)', border: 'rgba(200,162,80,0.18)', dot: 'var(--gold)' },
    blue: { bg: 'rgba(82,151,255,0.07)', border: 'rgba(82,151,255,0.20)', dot: '#74a9ff' },
    dim:  { bg: 'rgba(90,80,55,0.08)',   border: 'rgba(90,80,55,0.18)',   dot: 'var(--dim)' },
  }[tone]

  return (
    <div style={{ padding: '12px 16px', borderRadius: '10px', background: styles.bg, border: `1px solid ${styles.border}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: styles.dot, marginTop: '4px', flexShrink: 0 }} />
      <div style={{ fontSize: '11px', color: 'var(--sil)', lineHeight: 1.6 }}>{text}</div>
    </div>
  )
}

function tc(color: string) {
  return { padding: '12px 14px', textAlign: 'center' as const, fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: '12px', color }
}
