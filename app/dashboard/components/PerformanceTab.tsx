import type { PerformanceData, PerformanceNiche, PerformanceProduct } from '../types'
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
  const listMore = (data?.niches || []).filter((niche) => niche.action === 'List More')
  const avoid = (data?.niches || []).filter((niche) => niche.action === 'Avoid For Now')

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro
        eyebrow="EbayDash / Intelligence"
        title="Performance"
        subtitle={`Last ${data?.windowDays || 90} days of sales, profit, active listings, and available eBay traffic signals.`}
      />

      {!connected ? (
        <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect eBay to load category performance and listing signals." style={{ margin: '0 44px 44px' }} />
      ) : null}

      {connected && loading ? (
        <div className="card" style={{ margin: '0 44px 44px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--dim)' }}>Loading performance signals...</div>
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

      {connected && data && summary ? (
        <>
          {data.traffic.error ? (
            <div style={{ margin: '0 44px 24px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(200,162,80,0.08)', border: '1px solid rgba(200,162,80,0.18)', color: 'var(--sil)', fontSize: '12px', lineHeight: 1.7 }}>
              {data.traffic.error}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px', padding: '0 44px 24px' }}>
            <MetricCard label="Best Niche" value={summary.bestNiche || 'Learning'} tone="var(--grn)" compact />
            <MetricCard label="Avoid" value={summary.avoidNiche || 'None Yet'} tone={summary.avoidNiche ? 'var(--red)' : 'var(--dim)'} compact />
            <MetricCard label="Profit" value={`$${summary.totalProfit.toFixed(0)}`} tone={summary.totalProfit >= 0 ? 'var(--grn)' : 'var(--red)'} />
            <MetricCard label="Sales" value={summary.soldUnits.toString()} tone="var(--gld2)" />
            <MetricCard label="Views" value={summary.views.toString()} tone={data.traffic.available ? 'var(--gld2)' : 'var(--dim)'} />
            <MetricCard label="Watchers" value={summary.watchers.toString()} tone={data.traffic.watcherSignalsAvailable ? 'var(--gold)' : 'var(--dim)'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(280px,0.85fr)', gap: '20px', padding: '0 44px 24px' }}>
            <DecisionPanel
              title="What To List Next"
              subtitle="Niches with the strongest blend of sales, margin, profit, and buyer interest."
              niches={listMore.length > 0 ? listMore : (data.niches || []).slice(0, 4)}
              empty="No strong category has separated yet. Keep listing small tests until sales data builds."
              onOpenProductFinder={onOpenProductFinder}
            />
            <DecisionPanel
              title="Slow Areas"
              subtitle="Categories with weak demand, low profit, or thin engagement."
              niches={avoid.slice(0, 4)}
              empty="Nothing is clearly underperforming yet."
              onOpenProductFinder={onOpenProductFinder}
            />
          </div>

          <div style={{ padding: '0 44px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)' }}>
                Category Performance ({data.niches.length})
              </div>
              <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                Refresh Performance
              </button>
            </div>
            {data.niches.length === 0 ? (
              <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--dim)' }}>No performance data yet. List and sell a few tracked products to build recommendations.</div>
              </div>
            ) : (
              <NicheTable niches={data.niches} />
            )}
          </div>

          <div style={{ padding: '0 44px 44px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '14px' }}>
              Product Signals ({data.products.length})
            </div>
            {data.products.length === 0 ? (
              <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--dim)' }}>No product-level signals are available yet.</div>
              </div>
            ) : (
              <ProductTable products={data.products} />
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function DecisionPanel({
  title,
  subtitle,
  niches,
  empty,
  onOpenProductFinder,
}: {
  title: string
  subtitle: string
  niches: PerformanceNiche[]
  empty: string
  onOpenProductFinder: () => void
}) {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 600, color: 'var(--plat)', marginBottom: '6px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.5 }}>{subtitle}</div>
        </div>
        <button onClick={onOpenProductFinder} className="btn btn-gold btn-sm" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
          Source
        </button>
      </div>

      {niches.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--dim)', padding: '18px', borderRadius: '10px', background: 'rgba(0,0,0,0.18)' }}>{empty}</div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {niches.map((niche) => (
            <div key={niche.name} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(195,158,88,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt)' }}>{niche.name}</div>
                <StatusPill label={`${niche.score}/100`} tone={niche.tone} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--sil)', lineHeight: 1.55 }}>{niche.summary}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {niche.reasons.map((reason) => (
                  <span key={reason} style={{ fontSize: '9px', color: 'var(--dim)', padding: '3px 7px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)' }}>{reason}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NicheTable({ niches }: { niches: PerformanceNiche[] }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
            {['Niche', 'Score', 'Action', 'Sales', 'Profit', 'Margin', 'Views', 'Watchers', 'Sell-Through'].map((heading) => (
              <th key={heading} style={{ color: 'rgba(100,86,58,0.95)', fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '12px 14px', textAlign: heading === 'Niche' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {niches.map((niche, index) => (
            <tr key={niche.name} style={{ background: index % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)', borderBottom: '1px solid rgba(195,158,88,0.06)' }}>
              <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                <div style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{niche.name}</div>
                <div style={{ fontSize: '9px', color: 'var(--dim)', marginTop: '2px' }}>{niche.activeListings} active / {niche.listings} tracked</div>
              </td>
              <td style={cellStyle('var(--gld2)')}>{niche.score}</td>
              <td style={{ padding: '12px 14px', textAlign: 'center' }}><StatusPill label={niche.action} tone={niche.tone} /></td>
              <td style={cellStyle('var(--txt)')}>{niche.soldUnits}</td>
              <td style={cellStyle(niche.profit >= 0 ? 'var(--grn)' : 'var(--red)')}>${niche.profit.toFixed(2)}</td>
              <td style={cellStyle(niche.margin >= 0 ? 'var(--gold)' : 'var(--red)')}>{niche.margin.toFixed(1)}%</td>
              <td style={cellStyle('var(--sil)')}>{niche.views}</td>
              <td style={cellStyle('var(--sil)')}>{niche.watchers}</td>
              <td style={cellStyle('var(--sil)')}>{(niche.sellThrough * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProductTable({ products }: { products: PerformanceProduct[] }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
            {['Product', 'Niche', 'Score', 'Sales', 'Profit', 'Views', 'Watchers', 'Action'].map((heading) => (
              <th key={heading} style={{ color: 'rgba(100,86,58,0.95)', fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '12px 14px', textAlign: heading === 'Product' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.listingId || product.asin || product.title} style={{ background: index % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)', borderBottom: '1px solid rgba(195,158,88,0.06)' }}>
              <td style={{ padding: '12px 14px', maxWidth: '300px' }}>
                <div style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--dim)', marginTop: '2px' }}>{product.asin || product.listingId || 'Unmapped'}</div>
              </td>
              <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', color: 'var(--sil)' }}>{product.niche}</td>
              <td style={cellStyle('var(--gld2)')}>{product.score}</td>
              <td style={cellStyle('var(--txt)')}>{product.soldUnits}</td>
              <td style={cellStyle(product.profit >= 0 ? 'var(--grn)' : 'var(--red)')}>${product.profit.toFixed(2)}</td>
              <td style={cellStyle('var(--sil)')}>{product.views}</td>
              <td style={cellStyle('var(--sil)')}>{product.watchers}</td>
              <td style={{ padding: '12px 14px', textAlign: 'center' }}><StatusPill label={product.action} tone={product.action === 'List More' ? 'green' : product.action === 'Avoid For Now' ? 'red' : 'gold'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricCard({ label, value, tone, compact = false }: { label: string; value: string; tone: string; compact?: boolean }) {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '12px' }}>{label}</div>
      <div style={{ fontFamily: compact ? 'var(--serif)' : 'Space Grotesk,sans-serif', fontSize: compact ? '24px' : '34px', fontWeight: compact ? 600 : 800, color: tone, lineHeight: 1, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  const color = tone === 'green' ? 'var(--grn)' : tone === 'red' ? 'var(--red)' : 'var(--gold)'
  const background = tone === 'green' ? 'rgba(46,207,118,0.10)' : tone === 'red' ? 'rgba(232,63,80,0.10)' : 'rgba(200,162,80,0.10)'
  const border = tone === 'green' ? 'rgba(46,207,118,0.25)' : tone === 'red' ? 'rgba(232,63,80,0.25)' : 'rgba(200,162,80,0.25)'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '8px', fontWeight: 800, color, background, border: `1px solid ${border}`, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
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
