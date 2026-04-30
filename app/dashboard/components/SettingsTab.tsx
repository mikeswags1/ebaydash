import { SectionIntro } from './shared'
import type { ProductSourceHealth } from '../types'

export function SettingsTab({
  connected,
  needsReconnect,
  niche,
  nicheSaved,
  onSync,
  onDisconnectEbay,
  disconnectingEbay,
  onOpenProductTab,
  sourceHealth,
  sourceHealthLoading,
  sourceHealthError,
  onRefreshSourceHealth,
}: {
  connected: boolean
  needsReconnect: boolean
  niche: string | null
  nicheSaved: boolean
  onSync: () => void
  onDisconnectEbay: () => void
  disconnectingEbay: boolean
  onOpenProductTab: () => void
  sourceHealth: ProductSourceHealth | null
  sourceHealthLoading: boolean
  sourceHealthError: string | null
  onRefreshSourceHealth: () => void
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="StackPilot / Configuration" title="Settings" />

      <div style={{ padding: '0 44px 44px', maxWidth: '980px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          {connected ? (
            <>
              <StatusIcon tone="success" label="OK" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>eBay Connected</div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>Your eBay account is linked. Orders and listings can sync normally.</div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={onSync} className="btn btn-gold">
                  Sync Now
                </button>
                <a href="/api/ebay/connect" className="btn btn-ghost" style={{ fontSize: '12px' }}>
                  Reconnect eBay
                </a>
                <button
                  onClick={onDisconnectEbay}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', color: 'var(--red)', borderColor: 'rgba(248,81,101,0.28)' }}
                  disabled={disconnectingEbay}
                >
                  {disconnectingEbay ? 'Disconnecting...' : 'Disconnect eBay'}
                </button>
              </div>
            </>
          ) : (
            <>
              <StatusIcon tone="warning" label="eB" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>
                {needsReconnect ? 'Reconnect Your eBay Account' : 'Connect Your eBay Account'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>
                {needsReconnect
                  ? 'Your eBay session expired. Reconnect to restore order sync, listing, and dashboard actions.'
                  : 'Authorize your eBay account to load orders, sync listings, and publish products from the dashboard.'}
              </div>
              <a href="/api/ebay/connect" className="btn btn-solid" style={{ padding: '14px 36px', fontSize: '14px', display: 'inline-flex' }}>
                {needsReconnect ? 'Reconnect eBay Account' : 'Connect eBay Account'}
              </a>
              <div style={{ marginTop: '14px' }}>
                <a href="/api/ebay/connect?minimal=1" className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                  Try Basic eBay Connect
                </a>
              </div>
            </>
          )}
        </div>

        <ProductSourceHealthCard
          health={sourceHealth}
          loading={sourceHealthLoading}
          error={sourceHealthError}
          onRefresh={onRefreshSourceHealth}
        />

        {niche ? (
          <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: 'var(--sil)' }}>
              Active niche: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{niche}</span>
              {nicheSaved ? <span style={{ color: 'var(--grn)', marginLeft: '8px', fontSize: '11px' }}>Saved</span> : null}
            </div>
            <button onClick={onOpenProductTab} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
              Manage
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProductSourceHealthCard({
  health,
  loading,
  error,
  onRefresh,
}: {
  health: ProductSourceHealth | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  const status = health?.status || 'watch'
  const statusLabel = status === 'healthy' ? 'Healthy' : status === 'attention' ? 'Needs Attention' : 'Watch'
  const statusColor = status === 'healthy' ? 'var(--grn)' : status === 'attention' ? 'var(--red)' : 'var(--gold)'
  const imageCoverage = health && health.sourceEngine.totalProducts > 0
    ? Math.round(((health.sourceEngine.totalProducts - health.sourceEngine.missingImages) / health.sourceEngine.totalProducts) * 100)
    : 0
  const readyNicheLabel = health ? `${health.cache.readyNiches}/${health.cache.totalNiches}` : '--'

  return (
    <div className="card" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '22px' }}>
        <div>
          <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Product Source Health</div>
          <div style={{ color: 'var(--sil)', fontSize: '13px', lineHeight: 1.6 }}>
            Tracks source pool depth, niche cache readiness, and Continuous Listing stock.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ color: statusColor, border: `1px solid ${statusColor}`, background: status === 'healthy' ? 'rgba(46,207,118,0.1)' : status === 'attention' ? 'rgba(248,81,101,0.1)' : 'rgba(199,160,82,0.12)', borderRadius: '999px', padding: '7px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {loading ? 'Checking' : statusLabel}
          </span>
          <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ color: 'var(--red)', border: '1px solid rgba(248,81,101,0.25)', background: 'rgba(248,81,101,0.08)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', marginBottom: health ? '18px' : 0 }}>
          {error}
        </div>
      ) : null}

      {!health && !error ? (
        <div style={{ color: 'var(--dim)', border: '1px solid rgba(125,211,252,0.12)', borderRadius: '10px', padding: '22px', fontSize: '13px', textAlign: 'center' }}>
          {loading ? 'Checking product source health...' : 'Product source health has not been checked yet.'}
        </div>
      ) : null}

      {health ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', border: '1px solid rgba(125,211,252,0.14)', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
            <HealthMetric label="Source Pool" value={formatNumber(health.sourceEngine.totalProducts)} detail={`${formatNumber(health.sourceEngine.niches)} niches`} />
            <HealthMetric label="Niche Pools Ready" value={readyNicheLabel} detail={`${formatNumber(health.cache.totalProducts)} cached products`} />
            <HealthMetric label="Continuous Queue" value={formatNumber(health.continuous.products)} detail={`Version ${health.continuous.version || 0}`} />
            <HealthMetric label="Image Coverage" value={`${imageCoverage}%`} detail={`${formatNumber(health.sourceEngine.missingImages)} missing`} />
          </div>

          <div style={{ borderTop: '1px solid rgba(125,211,252,0.12)', paddingTop: '16px', marginBottom: '16px' }}>
            <div style={{ color: 'var(--txt)', fontWeight: 800, fontSize: '13px', marginBottom: '10px' }}>
              {health.warnings.length > 0 ? 'Watch Items' : 'Source Engine Healthy'}
            </div>
            {health.warnings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {health.warnings.map((warning) => (
                  <div key={warning} style={{ color: 'var(--gold)', fontSize: '13px', lineHeight: 1.5 }}>
                    {warning}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--sil)', fontSize: '13px', lineHeight: 1.6 }}>
                Source pool, niche caches, and Continuous Listing are stocked at the target levels.
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(125,211,252,0.12)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--txt)', fontWeight: 800, fontSize: '13px' }}>Top Source Niches</div>
              <div style={{ color: 'var(--dim)', fontSize: '11px' }}>
                Last checked {formatHealthDate(health.generatedAt)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {health.topNiches.slice(0, 6).map((niche) => (
                <div key={niche.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) auto auto', gap: '12px', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(125,211,252,0.08)' }}>
                  <div style={{ color: 'var(--txt)', fontWeight: 700, fontSize: '13px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{niche.name}</div>
                  <div style={{ color: 'var(--sil)', fontSize: '12px' }}>{formatNumber(niche.count)} items</div>
                  <div style={{ color: 'var(--sky)', fontSize: '12px', fontWeight: 800 }}>Score {Math.round(niche.averageScore)}</div>
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--dim)', fontSize: '11px', lineHeight: 1.5, marginTop: '12px' }}>
              RapidAPI fallback: {health.providers.rapidApiConfigured ? 'configured' : 'not configured'}.
              Continuous cache: {health.continuous.cachedAt ? formatHealthDate(health.continuous.cachedAt) : 'not warmed'}.
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function HealthMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ padding: '14px', borderRight: '1px solid rgba(125,211,252,0.1)', borderBottom: '1px solid rgba(125,211,252,0.1)', minHeight: '90px' }}>
      <div style={{ color: 'var(--dim)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>{label}</div>
      <div style={{ color: 'var(--txt)', fontSize: '24px', fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'var(--sil)', fontSize: '12px', marginTop: '8px' }}>{detail}</div>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

function formatHealthDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StatusIcon({ tone, label }: { tone: 'success' | 'warning'; label: string }) {
  const background = tone === 'success' ? 'rgba(46,207,118,0.12)' : 'rgba(14,165,233,0.10)'
  const border = tone === 'success' ? '1px solid rgba(46,207,118,0.3)' : '1px solid rgba(14,165,233,0.25)'
  const color = tone === 'success' ? 'var(--grn)' : 'var(--gold)'

  return (
    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background, border, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '18px', color, fontWeight: 700 }}>
      {label}
    </div>
  )
}
