'use client'

import type { Tab } from '../types'
import { MORE_SECTION_TABS } from '../constants'

function IconOverview() {
  return (
    <svg className="dashboard-bottomnav__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconOrders() {
  return (
    <svg className="dashboard-bottomnav__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function IconProducts() {
  return (
    <svg className="dashboard-bottomnav__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function IconMore() {
  return (
    <svg className="dashboard-bottomnav__icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

export function CompactBottomNav({
  tab,
  onTabChange,
  awaitingCount,
}: {
  tab: Tab
  onTabChange: (t: Tab) => void
  awaitingCount: number
}) {
  const moreActive = tab === 'more' || MORE_SECTION_TABS.includes(tab)

  const items = [
    { target: 'overview' as const, label: 'Overview', Icon: IconOverview },
    { target: 'orders' as const, label: 'Orders', Icon: IconOrders },
    { target: 'product' as const, label: 'Products', Icon: IconProducts },
    { target: 'more' as const, label: 'More', Icon: IconMore },
  ]

  return (
    <nav className="dashboard-bottomnav" aria-label="Primary navigation">
      {items.map((item) => {
        const active = item.target === 'more' ? moreActive : tab === item.target
        const Icon = item.Icon
        return (
          <button
            key={item.target}
            type="button"
            className={`dashboard-bottomnav__btn${active ? ' dashboard-bottomnav__btn--active' : ''}`}
            onClick={() => onTabChange(item.target)}
          >
            <span className="dashboard-bottomnav__icon-wrap">
              <Icon />
              {item.target === 'orders' && awaitingCount > 0 ? (
                <span className="dashboard-bottomnav__badge">{awaitingCount > 9 ? '9+' : awaitingCount}</span>
              ) : null}
            </span>
            <span className="dashboard-bottomnav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
