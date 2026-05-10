'use client'

export function CompactPwaMenu({
  open,
  onClose,
  onSync,
  syncing,
  syncTime,
  onFulfillment,
  onSettings,
  userLabel,
  subscriptionPlan,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  onSync: () => void
  syncing: boolean
  syncTime: string | null
  onFulfillment: () => void
  onSettings: () => void
  userLabel?: string | null
  subscriptionPlan?: string | null
  onSignOut: () => void
}) {
  if (!open) return null

  const planLabel = subscriptionPlan ? (String(subscriptionPlan).toLowerCase() === 'pro' ? 'Pro' : 'Trial') : null

  return (
    <>
      <button type="button" className="pwa-menu__scrim" aria-label="Close menu" onClick={onClose} />
      <aside className="pwa-menu" aria-label="App menu">
        <div className="pwa-menu__head">
          <span>Menu</span>
          {planLabel ? <span className="pwa-menu__plan">{planLabel}</span> : null}
        </div>
        {userLabel ? <div className="pwa-menu__account">{userLabel}</div> : null}
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
