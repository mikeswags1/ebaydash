'use client'

export function CompactPwaMenu({
  open,
  onClose,
  onSync,
  syncing,
  syncTime,
  onFulfillment,
  onSettings,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  onSync: () => void
  syncing: boolean
  syncTime: string | null
  onFulfillment: () => void
  onSettings: () => void
  onSignOut: () => void
}) {
  if (!open) return null

  return (
    <>
      <button type="button" className="pwa-menu__scrim" aria-label="Close menu" onClick={onClose} />
      <aside className="pwa-menu" aria-label="App menu">
        <div className="pwa-menu__head">Menu</div>
        <nav className="pwa-menu__nav">
          <button type="button" className="pwa-menu__link" onClick={() => { onSync(); onClose() }} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync eBay'}
          </button>
          {syncTime ? <div className="pwa-menu__hint">Last sync · {syncTime}</div> : null}
          <button type="button" className="pwa-menu__link" onClick={() => { onFulfillment(); onClose() }}>
            Fulfill orders
          </button>
          <button type="button" className="pwa-menu__link" onClick={() => { onSettings(); onClose() }}>
            Settings
          </button>
          <button type="button" className="pwa-menu__link pwa-menu__link--muted" onClick={() => { onSignOut(); onClose() }}>
            Sign out
          </button>
        </nav>
      </aside>
    </>
  )
}
