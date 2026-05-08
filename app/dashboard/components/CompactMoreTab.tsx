import type { Tab } from '../types'

const ROWS: Array<{ tab: Tab; title: string; hint: string }> = [
  { tab: 'fulfillment', title: 'Fulfillment', hint: 'Ship from Amazon' },
  { tab: 'settings', title: 'Settings', hint: 'eBay, sync, niche' },
  { tab: 'financials', title: 'Money', hint: 'Profit snapshot' },
  { tab: 'performance', title: 'Performance', hint: 'Sales at a glance' },
  { tab: 'continuous', title: 'Continuous listing', hint: 'Auto queue' },
  { tab: 'asin', title: 'ASIN lookup', hint: 'Map items' },
  { tab: 'scripts', title: 'Scripts', hint: 'Desktop workflows' },
  { tab: 'campaigns', title: 'Campaigns', hint: 'Promoted listings' },
]

export function CompactMoreTab({
  onOpenTab,
  onSignOut,
}: {
  onOpenTab: (t: Tab) => void
  onSignOut: () => void
}) {
  return (
    <div className="pwa-more">
      <h1 className="pwa-more__title">More</h1>
      <p className="pwa-more__intro">Quick settings and tools.</p>

      <div className="pwa-more__list">
        {ROWS.map((row) => (
          <button
            key={row.tab}
            type="button"
            className="pwa-more__row"
            onClick={() => onOpenTab(row.tab)}
          >
            <div className="pwa-more__row-title">{row.title}</div>
            <div className="pwa-more__row-hint">{row.hint}</div>
          </button>
        ))}
      </div>

      <button type="button" className="pwa-more__signout" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
