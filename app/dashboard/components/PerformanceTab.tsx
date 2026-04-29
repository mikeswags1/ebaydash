import type { PerformanceData, PerformanceNiche } from '../types'
import { EmptyState, SectionIntro } from './shared'

export function PerformanceTab({
  connected,
  loading,
  error,
  data,
  onRefresh,
  onOpenSettings,
  onOpenProductFinder,
}: {
  connected: boolean
  loading: boolean
  error: string | null
  data: PerformanceData | null
  onRefresh: () => void
  onOpenSettings: () => void
  onOpenProductFinder: () => void
}) {
  const summary = data?.summary

  const topNiches = (data?.niches || []).filter(n => n.action === 'List More').slice(0, 3)
  const slowNiches = (data?.niches || []).filter(n => n.action === 'Avoid For Now').slice(0, 3)
  const allNiches = data?.niches || []
  const topProducts = (data?.products || []).slice(0, 10)

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro
        eyebrow="StackPilot / Intelligence"
        title="Performance"
        subtitle="See what's selling, what's not, and exactly what to do next. Based on your last 90 days of eBay activity."
      />

      {!connected ? (
        <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect your eBay account to see your sales performance." style={{ margin: '0 44px 44px' }} />
      ) : null}

      {connected && loading ? (
        <div className="card" style={{ margin: '0 44px 44px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--dim)' }}>Loading your performance data...</div>
        </div>
      ) : null}

      {connected && error ? (
        <div className="card" style={{ margin: '0 44px 24px', padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>
          <button onClick={onRefresh} className="btn btn-gold btn-sm">Retry</button>
        </div>
      ) : null}

      {connected && !loading && !error && !data ? (
        <div className="card" style={{ margin: '0 44px 44px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '16px' }}>No performance data yet.</div>
          <button onClick={onRefresh} className="btn btn-gold btn-sm">Load Performance</button>
        </div>
      ) : null}

      {connected && data && summary ? (
        <>
          {/* Traffic note */}
          {data.traffic.error ? (
            <div style={{ margin: '0 44px 20px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.18)', color: 'var(--sil)', fontSize: '11px', lineHeight: 1.6 }}>
              ⚠ {data.traffic.error}
            </div>
          ) : null}

          {/* At-a-glance numbers */}
          <div style={{ padding: '0 44px 28px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--plat)', marginBottom: '12px' }}>
              Last 90 Days — At a Glance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '14px' }}>
              <GlanceCard
                label="Units Sold"
                value={summary.soldUnits.toString()}
                hint="Total items sold on eBay"
                tone="var(--gld2)"
              />
              <GlanceCard
                label="Net Profit"
                value={`$${summary.totalProfit.toFixed(0)}`}
                hint="Revenue minus Amazon cost and eBay fees"
                tone={summary.totalProfit >= 0 ? 'var(--grn)' : 'var(--red)'}
              />
              <GlanceCard
                label="Active Listings"
                value={summary.activeListings.toString()}
                hint="Items currently live on eBay"
                tone="var(--txt)"
              />
              <GlanceCard
                label="Buyer Views"
                value={data.traffic.available ? summary.views.toLocaleString() : '—'}
                hint={data.traffic.available ? 'Times buyers viewed your listings' : 'Requires eBay traffic access'}
                tone={data.traffic.available ? 'var(--sil)' : 'var(--dim)'}
              />
              <GlanceCard
                label="Watchers"
                value={data.traffic.watcherSignalsAvailable ? summary.watchers.toString() : '—'}
                hint="Buyers watching your items — signals demand"
                tone={data.traffic.watcherSignalsAvailable ? 'var(--gold)' : 'var(--dim)'}
              />
            </div>
          </div>

          {/* Action cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '0 44px 28px' }}>
            <ActionCard
              title="List More Of These"
              description="These categories are making you money. Source more products here."
              items={topNiches.length > 0 ? topNiches : allNiches.slice(0, 3)}
              tone="green"
              empty="Keep selling — once you have enough data, your best categories will appear here."
              onAction={onOpenProductFinder}
              actionLabel="Find Products"
            />
            <ActionCard
              title="Slow Down Here"
              description="These categories aren't performing well. Fewer listings or pause entirely."
              items={slowNiches}
              tone="red"
              empty="Nothing is clearly underperforming yet — that's a good sign."
              onAction={onRefresh}
              actionLabel="Refresh"
            />
          </div>

          {/* Category breakdown */}
          {allNiches.length > 0 ? (
            <div style={{ padding: '0 44px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--plat)' }}>
                    Category Breakdown
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '4px' }}>
                    How each category is performing across sales, profit, and buyer interest
                  </div>
                </div>
                <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>Refresh</button>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(224,247,255,0.74)', borderBottom: '1px solid rgba(14,116,144,0.12)' }}>
                      {[
                        { label: 'Category', hint: null },
                        { label: 'Status', hint: null },
                        { label: 'Units Sold', hint: null },
                        { label: 'Profit', hint: null },
                        { label: 'Avg Profit/Sale', hint: null },
                        { label: 'Margin', hint: 'Profit as % of revenue' },
                        { label: 'ROI', hint: 'Return on your Amazon cost' },
                        { label: 'Watchers', hint: 'Buyers watching your listings' },
                      ].map(col => (
                        <th key={col.label} style={{ color: 'var(--plat)', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, padding: '12px 14px', textAlign: col.label === 'Category' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                          {col.label}
                          {col.hint ? <div style={{ fontSize: '7px', color: 'var(--sil)', fontWeight: 400, letterSpacing: 0, textTransform: 'none', marginTop: '2px' }}>{col.hint}</div> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allNiches.map((niche, i) => (
                      <tr key={niche.name} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(238,250,255,0.72)', borderBottom: '1px solid rgba(14,116,144,0.08)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{niche.name}</div>
                          <div style={{ fontSize: '9px', color: 'var(--dim)', marginTop: '2px' }}>{niche.activeListings} active listing{niche.activeListings !== 1 ? 's' : ''}</div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <ActionPill action={niche.action} />
                        </td>
                        <td style={cell('var(--txt)')}>{niche.soldUnits}</td>
                        <td style={cell(niche.profit >= 0 ? 'var(--grn)' : 'var(--red)')}>${niche.profit.toFixed(0)}</td>
                        <td style={cell(niche.avgProfitPerSale >= 0 ? 'var(--sil)' : 'var(--red)')}>${niche.avgProfitPerSale.toFixed(2)}</td>
                        <td style={cell(niche.margin >= 20 ? 'var(--grn)' : niche.margin >= 10 ? 'var(--gold)' : 'var(--red)')}>{niche.margin.toFixed(1)}%</td>
                        <td style={cell(niche.roi >= 50 ? 'var(--grn)' : niche.roi >= 20 ? 'var(--gold)' : 'var(--red)')}>{niche.roi.toFixed(0)}%</td>
                        <td style={cell('var(--sil)')}>{niche.watchers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Top products */}
          {topProducts.length > 0 ? (
            <div style={{ padding: '0 44px 44px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--plat)', marginBottom: '4px' }}>
                Your Top Products
              </div>
              <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '12px' }}>
                Individual items ranked by profit and sales activity
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(224,247,255,0.74)', borderBottom: '1px solid rgba(14,116,144,0.12)' }}>
                      {['Product', 'Category', 'Sold', 'Profit', 'ROI', 'Watchers', 'Status'].map(h => (
                        <th key={h} style={{ color: 'var(--plat)', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, padding: '12px 14px', textAlign: h === 'Product' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.listingId || p.asin || p.title} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(238,250,255,0.72)', borderBottom: '1px solid rgba(14,116,144,0.08)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--dim)', marginTop: '2px' }}>{p.asin || p.listingId || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', color: 'var(--sil)' }}>{p.niche || '—'}</td>
                        <td style={cell('var(--txt)')}>{p.soldUnits}</td>
                        <td style={cell(p.profit >= 0 ? 'var(--grn)' : 'var(--red)')}>${p.profit.toFixed(2)}</td>
                        <td style={cell(p.roi >= 50 ? 'var(--grn)' : p.roi >= 20 ? 'var(--gold)' : 'var(--red)')}>{p.roi.toFixed(0)}%</td>
                        <td style={cell('var(--sil)')}>{p.watchers}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}><ActionPill action={p.action} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function GlanceCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--sil)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '30px', fontWeight: 800, color: tone, lineHeight: 1, marginBottom: '8px' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--dim)', lineHeight: 1.4 }}>{hint}</div>
    </div>
  )
}

function ActionCard({
  title, description, items, tone, empty, onAction, actionLabel,
}: {
  title: string
  description: string
  items: PerformanceNiche[]
  tone: 'green' | 'red'
  empty: string
  onAction: () => void
  actionLabel: string
}) {
  const borderColor = tone === 'green' ? 'rgba(46,207,118,0.18)' : 'rgba(232,63,80,0.12)'
  const titleColor = tone === 'green' ? 'var(--grn)' : 'var(--red)'

  return (
    <div className="card" style={{ padding: '24px', border: `1px solid ${borderColor}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: titleColor, marginBottom: '5px' }}>{title}</div>
          <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.55 }}>{description}</div>
        </div>
        <button onClick={onAction} className="btn btn-ghost btn-sm" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>{actionLabel}</button>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--sil)', padding: '14px', borderRadius: '8px', background: 'rgba(226,247,255,0.52)', lineHeight: 1.6 }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(niche => (
            <div key={niche.name} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(226,247,255,0.52)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt)' }}>{niche.name}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: tone === 'green' ? 'var(--grn)' : 'var(--red)' }}>
                  {niche.soldUnits} sold · ${niche.profit.toFixed(0)} profit
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.5 }}>{niche.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionPill({ action }: { action: string }) {
  const isGood = action === 'List More'
  const isBad = action === 'Avoid For Now'
  const color = isGood ? 'var(--grn)' : isBad ? 'var(--red)' : 'var(--gold)'
  const bg = isGood ? 'rgba(46,207,118,0.10)' : isBad ? 'rgba(232,63,80,0.10)' : 'rgba(14,165,233,0.10)'
  const border = isGood ? 'rgba(46,207,118,0.25)' : isBad ? 'rgba(232,63,80,0.25)' : 'rgba(14,165,233,0.25)'
  const label = isGood ? '✓ Keep Listing' : isBad ? '✗ Slow Down' : '~ Monitor'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '8px', fontWeight: 800, color, background: bg, border: `1px solid ${border}`, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0 }}>
      {label}
    </span>
  )
}

function cell(color: string) {
  return { padding: '12px 14px', textAlign: 'center' as const, fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: '12px', color }
}
