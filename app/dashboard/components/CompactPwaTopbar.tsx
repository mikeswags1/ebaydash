'use client'

export function CompactPwaTopbar({
  connected,
  onMenuClick,
  onStatusClick,
}: {
  connected: boolean
  onMenuClick: () => void
  onStatusClick: () => void
}) {
  return (
    <header className="pwa-topbar">
      <button type="button" className="pwa-topbar__menu" onClick={onMenuClick} aria-label="Open menu">
        <span className="pwa-topbar__burger" aria-hidden />
      </button>
      <div className="pwa-topbar__brand">StackPilot</div>
      <button type="button" className="pwa-topbar__status" onClick={onStatusClick}>
        <span className={`pwa-topbar__dot${connected ? '' : ' pwa-topbar__dot--off'}`} aria-hidden />
        {connected ? 'eBay Connected' : 'eBay Offline'}
      </button>
    </header>
  )
}
