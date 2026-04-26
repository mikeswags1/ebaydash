import { NAV_ITEMS } from '../constants'
import type { BannerState, Tab } from '../types'

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
      className="dashboard-banner"
      style={{
        padding: '10px 44px',
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
}: {
  tab: Tab
  syncTime: string | null
  syncing: boolean
  onSync: () => void
}) {
  return (
    <header
      className="dashboard-topbar"
      style={{
        height: '56px',
        background: 'rgba(12,9,4,0.96)',
        backdropFilter: 'blur(70px)',
        borderBottom: '1px solid rgba(195,158,88,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 44px',
        position: 'sticky',
        top: 0,
        zIndex: 200,
        boxShadow: '0 1px 40px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sil)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {NAV_ITEMS.find((item) => item.id === tab)?.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {syncTime ? <span style={{ fontSize: '10px', color: 'var(--dim)' }}>Synced {syncTime}</span> : null}
        <button onClick={onSync} className="btn btn-gold btn-sm" disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync eBay'}
        </button>
      </div>
    </header>
  )
}
