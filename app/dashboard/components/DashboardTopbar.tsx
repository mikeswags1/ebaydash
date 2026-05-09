import { NAV_ITEMS } from '../constants'
import type { BannerState, Tab } from '../types'
import { TrialMeter } from './TrialMeter'

export function DashboardBanner({
  banner,
  onClose,
}: {
  banner: BannerState | null
  onClose: () => void
}) {
  if (!banner) return null

  const success = banner.tone === 'success'

  return (
    <div
      className={`dashboard-banner dashboard-banner--${success ? 'success' : 'error'}`}
      style={{
        padding: '10px var(--xpad)',
        fontSize: '12px',
        fontWeight: 600,
        background: success ? 'rgba(46,207,118,0.10)' : 'rgba(232,63,80,0.10)',
        color: success ? 'var(--grn)' : 'var(--red)',
        borderBottom: success ? '1px solid rgba(46,207,118,0.2)' : '1px solid rgba(232,63,80,0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {banner.text}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}>
        Close
      </button>
    </div>
  )
}

export function DashboardTopbar({
  tab,
  syncTime,
  syncing,
  onSync,
  onToggleNav,
  compact,
  trial,
}: {
  tab: Tab
  syncTime: string | null
  syncing: boolean
  onSync: () => void
  onToggleNav: () => void
  compact?: boolean
  trial?: { loading: boolean; plan: string; listed: number; trialLimit: number }
}) {
  const showTrial = trial && !compact

  return (
    <header
      className={`dashboard-topbar${compact ? ' dashboard-topbar--compact' : ''}`}
      style={{
        height: showTrial ? 'auto' : '56px',
        minHeight: '56px',
        background: 'rgba(8,17,31,0.84)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(125,211,252,0.14)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: 0,
        position: 'sticky',
        top: 0,
        zIndex: 200,
        boxShadow: '0 1px 22px rgba(0,0,0,0.22)',
      }}
    >
      <div
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--xpad)',
        }}
      >
        <div className="dashboard-topbar-left">
          {compact ? null : (
            <button type="button" className="dashboard-nav-toggle" onClick={onToggleNav} aria-label="Open navigation">
              Menu
            </button>
          )}
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--plat)', letterSpacing: 0, textTransform: 'uppercase' }}>
            {(NAV_ITEMS.find((item) => item.id === tab)?.label || '').replace(/^\p{Emoji}\s*/u, '').trim()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {syncTime ? <span style={{ fontSize: '10px', color: 'var(--dim)' }}>Synced {syncTime}</span> : null}
          <button onClick={onSync} className="btn btn-gold btn-sm" disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync eBay'}
          </button>
        </div>
      </div>
      {showTrial ? (
        <TrialMeter
          variant="topbar"
          loading={trial.loading}
          plan={trial.plan}
          listed={trial.listed}
          trialLimit={trial.trialLimit}
        />
      ) : null}
    </header>
  )
}
