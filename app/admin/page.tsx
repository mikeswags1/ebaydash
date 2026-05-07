'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Customer = {
  id: number
  email: string
  name: string
  joined: string | null
  ebayConnected: boolean
  ebayUpdatedAt: string | null
  ebayTokenExpiresAt: string | null
  totalListings: number
  activeListings: number
  activeProfit: number
  lastListingAt: string | null
  activeRecently: boolean
}

type RecentListing = {
  id: number
  userId: number
  sellerName: string
  sellerEmail: string
  asin: string
  title: string
  ebayListingId: string
  listedAt: string | null
  amazonPrice: number
  ebayPrice: number
  niche: string
  categoryId: string
  imageCount: number
}

type ProblemListing = RecentListing & {
  categoryName: string
  cacheImageCount: number
  cacheUpdatedAt: string | null
  cacheAvailable: boolean | null
  issues: string[]
  repairHint: string
}

type SourceNiche = {
  name: string
  count: number
  averageScore: number
  maxScore: number
  newestSeenAt: string | null
}

type NichePerformance = {
  niche: string
  listings: number
  sellers: number
  revenue: number
  profit: number
}

type Stats = {
  ok?: boolean
  generatedAt: string
  status: 'healthy' | 'watch' | 'attention'
  warnings: string[]
  totalUsers: number
  ebayConnected: number
  activeRecently: number
  customers: Customer[]
  listingSummary: {
    totalListings: number
    activeListings: number
    listed7Days: number
    listed30Days: number
    lowImageActive: number
    missingCategoryActive: number
    activeRevenue: number
    activeCost: number
    activeProfit: number
    averageRoi: number
  }
  sourceHealth: {
    sourceEngine: {
      totalProducts: number
      niches: number
      staleProducts: number
      missingImages: number
      highRiskProducts: number
      averageScore: number
      newestSeenAt: string | null
    }
    cache: {
      totalNiches: number
      readyNiches: number
      staleNiches: number
      totalProducts: number
    }
    continuous: {
      products: number
      version: number
      cachedAt: string | null
    }
    topNiches: SourceNiche[]
  }
  recentListings: RecentListing[]
  problemListings: ProblemListing[]
  nichePerformance: NichePerformance[]
}

type ToolState = {
  active: string | null
  tone: 'info' | 'success' | 'error'
  message: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0))
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function truncate(value: string, length = 58) {
  if (!value) return '-'
  return value.length > length ? `${value.slice(0, length - 1)}...` : value
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || data?.message || `Request failed (${res.status})`)
  }
  return data
}

function usePoolRefresh(onDone: () => void) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const trigger = async (mode: 'catalog' | 'sourceOnly') => {
    setState('running')
    setMsg(mode === 'catalog' ? 'Deep catalog crawl running. This can take a few minutes.' : 'Quick refresh running.')
    try {
      const res = await fetch('/api/admin/refresh-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await readJson(res)
      const result = data.result || {}
      setState('done')
      setMsg(
        `Done. ${result.nichesRefreshed ?? 0} niches refreshed, ${formatNumber(result.sourceProducts ?? 0)} products in source pool, ${formatNumber(result.continuousProducts ?? 0)} in continuous queue.`
      )
      onDone()
    } catch (error) {
      setState('error')
      setMsg(error instanceof Error ? error.message : 'Refresh failed.')
    }
  }

  return { state, msg, trigger }
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [collab, setCollab] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolState, setToolState] = useState<ToolState>({ active: null, tone: 'info', message: '' })

  const loadAdmin = useCallback(async () => {
    setError(null)
    const [statsRes, collabRes] = await Promise.all([
      fetch('/api/admin/stats').then(readJson),
      fetch('/api/admin/collab', { cache: 'no-store' }).then(readJson),
    ])
    setStats(statsRes as Stats)
    setCollab(String(collabRes?.content || ''))
  }, [])

  const pool = usePoolRefresh(() => {
    loadAdmin().catch(() => {})
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }
    if (status !== 'authenticated') return

    setLoading(true)
    loadAdmin()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load admin dashboard.'))
      .finally(() => setLoading(false))
  }, [loadAdmin, router, status])

  const statusCopy = useMemo(() => {
    if (!stats) return { label: 'Loading', detail: 'Checking launch status.' }
    if (stats.status === 'healthy') return { label: 'Healthy', detail: 'Core launch systems look ready.' }
    if (stats.status === 'watch') return { label: 'Watch', detail: 'A few items need monitoring before launch.' }
    return { label: 'Attention', detail: 'Fix the highlighted items before wider launch.' }
  }, [stats])

  const runTool = async (id: string, label: string, url: string, method: 'GET' | 'POST' = 'GET') => {
    setToolState({ active: id, tone: 'info', message: `${label} running...` })
    try {
      const data = await readJson(await fetch(url, { method }))
      setToolState({
        active: null,
        tone: 'success',
        message: data.message || data.result?.message || `${label} completed.`,
      })
      await loadAdmin()
    } catch (err) {
      setToolState({
        active: null,
        tone: 'error',
        message: err instanceof Error ? err.message : `${label} failed.`,
      })
    }
  }

  if (loading) {
    return (
      <div className="admin-loading">
        Loading StackPilot Admin...
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="admin-loading admin-loading-error">
        {error || 'Access denied.'}
      </div>
    )
  }

  const listingSummary = stats.listingSummary
  const source = stats.sourceHealth.sourceEngine
  const cache = stats.sourceHealth.cache
  const continuous = stats.sourceHealth.continuous

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div className="admin-topbar-actions">
          <span>{session?.user?.email}</span>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
        </div>
      </header>

      <section className="admin-shell">
        <div className="admin-hero">
          <div>
            <div className="admin-kicker">Admin Control Center</div>
            <h1>Launch operations</h1>
            <p>
              The admin page now shows account health, listing health, product pool depth,
              continuous queue readiness, recent listings, and the tools you need to keep StackPilot stable.
            </p>
          </div>
          <div className={`admin-status-card admin-status-${stats.status}`}>
            <span>System status</span>
            <strong>{statusCopy.label}</strong>
            <p>{statusCopy.detail}</p>
            <small>Updated {formatDateTime(stats.generatedAt)}</small>
          </div>
        </div>

        <div className="admin-metrics-grid">
          <MetricCard label="Accounts" value={formatNumber(stats.totalUsers)} detail={`${stats.ebayConnected} eBay connected`} />
          <MetricCard label="Active Listings" value={formatNumber(listingSummary.activeListings)} detail={`${formatNumber(listingSummary.listed30Days)} listed in 30 days`} />
          <MetricCard label="Active Profit" value={formatMoney(listingSummary.activeProfit)} detail={`${Math.round(listingSummary.averageRoi || 0)}% average ROI`} />
          <MetricCard label="Source Pool" value={formatNumber(source.totalProducts)} detail={`${source.niches} niches tracked`} />
          <MetricCard label="Continuous Queue" value={formatNumber(continuous.products)} detail={`Version ${continuous.version || 0}`} />
          <MetricCard label="Niche Caches" value={`${cache.readyNiches}/${cache.totalNiches}`} detail={`${cache.staleNiches} stale caches`} />
        </div>

        <section className="admin-grid admin-grid-2">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span>Launch warnings</span>
                <h2>What needs attention</h2>
              </div>
            </div>
            {stats.warnings.length === 0 ? (
              <div className="admin-empty">No current launch warnings.</div>
            ) : (
              <div className="admin-warning-list">
                {stats.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            )}
            <div className="admin-warning-actions">
              <button
                className="btn btn-solid btn-sm"
                disabled={toolState.active !== null}
                onClick={() => runTool('repair-listings', 'Fix All listing warnings', '/api/admin/repair-listings', 'POST')}
              >
                {toolState.active === 'repair-listings' ? 'Fixing...' : 'Fix All'}
              </button>
              <span>Repairs stored listing images and category data across every account.</span>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span>Admin tools</span>
                <h2>Actions</h2>
              </div>
            </div>
            <div className="admin-tool-grid">
              <button className="admin-tool" disabled={pool.state === 'running'} onClick={() => pool.trigger('sourceOnly')}>
                <strong>Quick Refresh</strong>
                <span>Reprice, enrich, and rebuild ready queues.</span>
              </button>
              <button className="admin-tool" disabled={pool.state === 'running'} onClick={() => pool.trigger('catalog')}>
                <strong>Deep Catalog Crawl</strong>
                <span>Run the heavier rotating source-pool crawl.</span>
              </button>
              <button className="admin-tool" disabled={toolState.active !== null} onClick={() => runTool('setup', 'Database setup', '/api/setup-db')}>
                <strong>Repair Database</strong>
                <span>Ensure required tables and columns exist.</span>
              </button>
              <button className="admin-tool" disabled={toolState.active !== null} onClick={() => runTool('audit', 'Listing audit', '/api/scripts/run?script=listing-audit.js')}>
                <strong>Listing Audit</strong>
                <span>Check your active listings for local quality issues.</span>
              </button>
              <button className="admin-tool" disabled={toolState.active !== null} onClick={() => runTool('orders', 'Order check', '/api/scripts/run?script=check-orders.js')}>
                <strong>Check Orders</strong>
                <span>Check eBay orders needing shipment.</span>
              </button>
              <Link className="admin-tool" href="/dashboard">
                <strong>Open Dashboard</strong>
                <span>Jump back into the main app.</span>
              </Link>
            </div>
            {(pool.msg || toolState.message) && (
              <div className={`admin-tool-message admin-tool-${pool.state === 'error' || toolState.tone === 'error' ? 'error' : pool.state === 'done' || toolState.tone === 'success' ? 'success' : 'info'}`}>
                {pool.msg || toolState.message}
              </div>
            )}
          </div>
        </section>

        <section className="admin-grid admin-grid-2">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span>Product source health</span>
                <h2>Pool readiness</h2>
              </div>
            </div>
            <div className="admin-health-grid">
              <SmallStat label="Average score" value={source.averageScore.toFixed(1)} />
              <SmallStat label="Stale products" value={formatNumber(source.staleProducts)} />
              <SmallStat label="Missing images" value={formatNumber(source.missingImages)} />
              <SmallStat label="High risk" value={formatNumber(source.highRiskProducts)} />
            </div>
            <div className="admin-subtle-line">
              Newest product seen {formatDateTime(source.newestSeenAt)}. Continuous queue cached {formatDateTime(continuous.cachedAt)}.
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span>Listing quality</span>
                <h2>Stored listing checks</h2>
              </div>
            </div>
            <div className="admin-health-grid">
              <SmallStat label="Total listed" value={formatNumber(listingSummary.totalListings)} />
              <SmallStat label="Listed 7 days" value={formatNumber(listingSummary.listed7Days)} />
              <SmallStat label="Low-image active" value={formatNumber(listingSummary.lowImageActive)} />
              <SmallStat label="Missing category" value={formatNumber(listingSummary.missingCategoryActive)} />
            </div>
            <div className="admin-subtle-line">
              Active revenue {formatMoney(listingSummary.activeRevenue)} against {formatMoney(listingSummary.activeCost)} stored cost basis.
            </div>
          </div>
        </section>

        <section className="admin-grid admin-grid-2">
          <AdminList
            title="Top source niches"
            eyebrow="Pool depth"
            items={stats.sourceHealth.topNiches.map((niche) => ({
              key: niche.name,
              left: niche.name,
              right: `${formatNumber(niche.count)} items`,
              meta: `Avg score ${Math.round(niche.averageScore)} - max ${Math.round(niche.maxScore)}`,
            }))}
          />
          <AdminList
            title="Best listing niches"
            eyebrow="Last 90 days"
            items={stats.nichePerformance.map((niche) => ({
              key: niche.niche,
              left: niche.niche,
              right: formatMoney(niche.profit),
              meta: `${formatNumber(niche.listings)} listings - ${formatNumber(niche.sellers)} seller(s)`,
            }))}
          />
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Problem listings</span>
              <h2>Exact listings behind the warnings</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-problem-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Issues</th>
                  <th>Images</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Listed</th>
                </tr>
              </thead>
              <tbody>
                {stats.problemListings.length === 0 ? (
                  <tr><td colSpan={7}>No problem listings found.</td></tr>
                ) : stats.problemListings.map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <strong>{truncate(listing.title, 74)}</strong>
                      <span>
                        {listing.asin || 'No ASIN'}
                        {listing.ebayListingId ? (
                          <>
                            {' - '}
                            <a href={`https://www.ebay.com/itm/${listing.ebayListingId}`} target="_blank" rel="noreferrer">
                              eBay {listing.ebayListingId}
                            </a>
                          </>
                        ) : ''}
                      </span>
                    </td>
                    <td>
                      <strong>{listing.sellerName || listing.sellerEmail}</strong>
                      <span>{listing.sellerEmail}</span>
                    </td>
                    <td>
                      <div className="admin-issue-stack">
                        {listing.issues.map((issue) => (
                          <span className="admin-issue" key={`${listing.id}-${issue}`}>{issue}</span>
                        ))}
                        <small>{listing.repairHint}</small>
                      </div>
                    </td>
                    <td>
                      <strong>{listing.imageCount}</strong>
                      <span>{listing.cacheImageCount} cached</span>
                    </td>
                    <td>
                      <strong>{listing.categoryId || '-'}</strong>
                      <span>{listing.categoryName || listing.niche}</span>
                    </td>
                    <td>
                      <strong>{formatMoney(listing.ebayPrice)}</strong>
                      <span>Cost {formatMoney(listing.amazonPrice)}</span>
                    </td>
                    <td>{formatDate(listing.listedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stats.problemListings.length >= 100 ? (
            <div className="admin-subtle-line">Showing the first 100 problem listings. Run Fix All, refresh, then review the remaining rows.</div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Recent listings</span>
              <h2>Latest published products</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Prices</th>
                  <th>Images</th>
                  <th>Category</th>
                  <th>Listed</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentListings.length === 0 ? (
                  <tr><td colSpan={6}>No listings recorded yet.</td></tr>
                ) : stats.recentListings.map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <strong>{truncate(listing.title, 70)}</strong>
                      <span>{listing.asin}{listing.ebayListingId ? ` - eBay ${listing.ebayListingId}` : ''}</span>
                    </td>
                    <td>
                      <strong>{listing.sellerName || listing.sellerEmail}</strong>
                      <span>{listing.sellerEmail}</span>
                    </td>
                    <td>
                      <strong>{formatMoney(listing.ebayPrice)}</strong>
                      <span>Cost {formatMoney(listing.amazonPrice)}</span>
                    </td>
                    <td>{listing.imageCount}</td>
                    <td>
                      <strong>{listing.categoryId || '-'}</strong>
                      <span>{listing.niche}</span>
                    </td>
                    <td>{formatDate(listing.listedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Accounts</span>
              <h2>Customer health</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>eBay</th>
                  <th>Listings</th>
                  <th>Profit</th>
                  <th>Last listing</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.customers.length === 0 ? (
                  <tr><td colSpan={6}>No customer accounts yet.</td></tr>
                ) : stats.customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name || customer.email}</strong>
                      <span>{customer.email}</span>
                    </td>
                    <td>
                      <StatusPill active={customer.ebayConnected} activeText="Connected" inactiveText="Missing" />
                      <span>{formatDate(customer.ebayUpdatedAt)}</span>
                    </td>
                    <td>
                      <strong>{formatNumber(customer.activeListings)} active</strong>
                      <span>{formatNumber(customer.totalListings)} total</span>
                    </td>
                    <td>{formatMoney(customer.activeProfit)}</td>
                    <td>
                      <StatusPill active={customer.activeRecently} activeText="Recent" inactiveText="Quiet" />
                      <span>{formatDate(customer.lastListingAt)}</span>
                    </td>
                    <td>{formatDate(customer.joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <details>
            <summary>
              <span>Collaboration log</span>
              <strong>COLLAB.md live notes</strong>
            </summary>
            <pre className="admin-collab">{collab || 'COLLAB.md not loaded.'}</pre>
          </details>
        </section>
      </section>
    </main>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-small-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusPill({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  return (
    <span className={`admin-pill ${active ? 'admin-pill-good' : 'admin-pill-muted'}`}>
      {active ? activeText : inactiveText}
    </span>
  )
}

function AdminList({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string
  title: string
  items: Array<{ key: string; left: string; right: string; meta: string }>
}) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="admin-empty">No data yet.</div>
      ) : (
        <div className="admin-list">
          {items.map((item) => (
            <div key={item.key}>
              <div>
                <strong>{item.left}</strong>
                <span>{item.meta}</span>
              </div>
              <em>{item.right}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
