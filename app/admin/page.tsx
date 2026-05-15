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

type TrendingNiche = {
  name: string
  activeProducts: number
  cacheProducts: number
  averageProfit: number
  averageRoi: number
  averageScore: number
  latestSeenAt: string | null
  cacheRefreshedAt: string | null
  missingImages: number
  highRiskProducts: number
  status: 'ready' | 'watch' | 'low'
}

type SourceRecommendation = {
  niche: string
  healthScore: number
  readyProducts: number
  cacheProducts: number
  activeProducts: number
  staleProducts: number
  unavailableProducts: number
  failedQueue30d: number
  completedQueue30d: number
  averageProfit: number
  averageRoi: number
  learningMultiplier: number
  recommendedAction: string
  lastCacheAt: string | null
  updatedAt: string | null
}

type SourceRun = {
  id: string
  mode: string
  trigger: string
  status: string
  productsFound: number
  productsRejected: number
  readyToList: number
  durationMs: number
  createdAt: string | null
  error: string | null
}

type SourceIntelligenceSummary = {
  status: 'healthy' | 'self-healing' | 'watch' | string
  lastRun: SourceRun | null
  runsToday: number
  productsFoundToday: number
  productsRejectedToday: number
  readyToListProducts: number
  weakNiches: number
  averageNicheHealth: number
  failedJobs24h: number
  recentRuns: SourceRun[]
  recommendations: SourceRecommendation[]
}

type ManagedSourceNiche = {
  name: string
  queries: string[]
  active: boolean
  notes: string
  updatedAt: string | null
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
    intelligence: SourceIntelligenceSummary | null
    topNiches: SourceNiche[]
    trendingNiches: TrendingNiche[]
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

function formatDuration(value: number) {
  if (!value) return '0s'
  const seconds = Math.max(1, Math.round(value / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`
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
  const [collabFileMtime, setCollabFileMtime] = useState<string | null>(null)
  const [collabGitSha, setCollabGitSha] = useState<string | null>(null)
  const [collabDeploymentId, setCollabDeploymentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolState, setToolState] = useState<ToolState>({ active: null, tone: 'info', message: '' })
  const [sourceNiches, setSourceNiches] = useState<ManagedSourceNiche[]>([])
  const [nicheForm, setNicheForm] = useState({ name: '', queries: '', notes: '' })
  const [nicheAction, setNicheAction] = useState<string | null>(null)

  const loadAdmin = useCallback(async () => {
    setError(null)
    const [statsRes, collabRes, sourceNicheRes] = await Promise.all([
      fetch('/api/admin/stats').then(readJson),
      fetch(`/api/admin/collab?t=${Date.now()}`, { cache: 'no-store' }).then(readJson),
      fetch('/api/admin/source-niches').then(readJson),
    ])
    setStats(statsRes as Stats)
    setSourceNiches(Array.isArray(sourceNicheRes?.customNiches) ? sourceNicheRes.customNiches : [])
    setCollab(String(collabRes?.content || ''))
    setCollabFileMtime(
      typeof collabRes?.fileMtime === 'string' && collabRes.fileMtime ? collabRes.fileMtime : null
    )
    setCollabGitSha(typeof collabRes?.gitSha === 'string' && collabRes.gitSha ? collabRes.gitSha : null)
    setCollabDeploymentId(
      typeof collabRes?.deploymentId === 'string' && collabRes.deploymentId ? collabRes.deploymentId : null
    )
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

  const refreshNiche = async (name: string) => {
    setNicheAction(`refresh:${name}`)
    setToolState({ active: null, tone: 'info', message: `Refreshing ${name} source products...` })
    try {
      const data = await readJson(await fetch('/api/admin/refresh-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'catalog', niche: name }),
      }))
      const attempted = Array.isArray(data?.result?.nichesAttempted) ? data.result.nichesAttempted.join(', ') : name
      setToolState({
        active: null,
        tone: 'success',
        message: `Refresh started for ${attempted}. Source pool now has ${formatNumber(data?.result?.sourceProducts ?? 0)} products.`,
      })
      await loadAdmin()
    } catch (err) {
      setToolState({
        active: null,
        tone: 'error',
        message: err instanceof Error ? err.message : `Could not refresh ${name}.`,
      })
    } finally {
      setNicheAction(null)
    }
  }

  const saveSourceNiche = async () => {
    setNicheAction('save')
    try {
      await readJson(await fetch('/api/admin/source-niches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nicheForm),
      }))
      setNicheForm({ name: '', queries: '', notes: '' })
      setToolState({ active: null, tone: 'success', message: 'Source niche saved. Run a niche refresh to stock it now.' })
      await loadAdmin()
    } catch (err) {
      setToolState({ active: null, tone: 'error', message: err instanceof Error ? err.message : 'Could not save source niche.' })
    } finally {
      setNicheAction(null)
    }
  }

  const editSourceNiche = (niche: ManagedSourceNiche) => {
    setNicheForm({
      name: niche.name,
      queries: niche.queries.join('\n'),
      notes: niche.notes,
    })
  }

  const setSourceNicheActive = async (name: string, active: boolean) => {
    setNicheAction(`toggle:${name}`)
    try {
      await readJson(await fetch('/api/admin/source-niches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, active }),
      }))
      setToolState({ active: null, tone: 'success', message: `${name} ${active ? 'enabled' : 'disabled'} for future source crawls.` })
      await loadAdmin()
    } catch (err) {
      setToolState({ active: null, tone: 'error', message: err instanceof Error ? err.message : 'Could not update source niche.' })
    } finally {
      setNicheAction(null)
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
  const intelligence = stats.sourceHealth.intelligence

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
                <span>Source intelligence</span>
                <h2>Always-on product engine</h2>
              </div>
              <span className={`admin-pill admin-pill-${intelligence?.status === 'healthy' ? 'good' : intelligence?.status === 'self-healing' ? 'watch' : 'bad'}`}>
                {intelligence?.status ? intelligence.status.replace('-', ' ') : 'No data'}
              </span>
            </div>
            <div className="admin-health-grid">
              <SmallStat label="Found today" value={formatNumber(intelligence?.productsFoundToday || 0)} />
              <SmallStat label="Rejected today" value={formatNumber(intelligence?.productsRejectedToday || 0)} />
              <SmallStat label="Ready products" value={formatNumber(intelligence?.readyToListProducts || 0)} />
              <SmallStat label="Avg niche health" value={`${Math.round(intelligence?.averageNicheHealth || 0)}%`} />
            </div>
            <div className="admin-source-intel-row">
              <div>
                <strong>Last crawl</strong>
                <span>{formatDateTime(intelligence?.lastRun?.createdAt || null)}</span>
              </div>
              <div>
                <strong>Runs today</strong>
                <span>{formatNumber(intelligence?.runsToday || 0)}</span>
              </div>
              <div>
                <strong>Weak niches</strong>
                <span>{formatNumber(intelligence?.weakNiches || 0)}</span>
              </div>
              <div>
                <strong>Failed jobs</strong>
                <span>{formatNumber(intelligence?.failedJobs24h || 0)}</span>
              </div>
            </div>
            <div className="admin-subtle-line">
              Scores combine product quality, profit, ROI, freshness, images, listing outcomes, and niche health. Weak niches are prioritized on the next deep refresh.
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span>Recommended actions</span>
                <h2>What to fix next</h2>
              </div>
            </div>
            {!intelligence?.recommendations?.length ? (
              <div className="admin-empty">No source-engine recommendations yet.</div>
            ) : (
              <div className="admin-action-list">
                {intelligence.recommendations.slice(0, 5).map((item) => (
                  <div key={item.niche}>
                    <div>
                      <strong>{item.niche}</strong>
                      <span>{item.recommendedAction}</span>
                    </div>
                    <em>{Math.round(item.healthScore)}%</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

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
                <span>Heavy on-demand crawl (3 niches). Production runs hourly background catalog via cron (2-job limit keeps auto-listing).</span>
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

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Recent source jobs</span>
              <h2>Crawls, scoring, and self-healing history</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-source-runs-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Ready</th>
                  <th>Duration</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {!intelligence?.recentRuns?.length ? (
                  <tr><td colSpan={6}>No source job history yet. Run Quick Refresh or wait for the production cron.</td></tr>
                ) : intelligence.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong>{run.mode}</strong>
                      <span>{run.trigger}</span>
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${run.status === 'success' ? 'good' : run.status === 'partial' ? 'watch' : 'bad'}`}>
                        {run.status}
                      </span>
                      {run.error ? <span>{truncate(run.error, 80)}</span> : null}
                    </td>
                    <td>
                      <strong>{formatNumber(run.productsFound)} found</strong>
                      <span>{formatNumber(run.productsRejected)} rejected</span>
                    </td>
                    <td>{formatNumber(run.readyToList)}</td>
                    <td>{formatDuration(run.durationMs)}</td>
                    <td>{formatDateTime(run.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-subtle-line">
            The daily Vercel cron refreshes the catalog safely; admin refreshes can repair a weak niche immediately without adding extra scheduled jobs.
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Source flow</span>
              <h2>How products become ready to list</h2>
            </div>
          </div>
          <div className="admin-flow-grid">
            <div>
              <strong>1. Source niche</strong>
              <span>StackPilot rotates through active niches and trend-focused Amazon searches.</span>
            </div>
            <div>
              <strong>2. Validate Amazon</strong>
              <span>ASIN, title, price, images, rating, reviews, and availability are checked before use.</span>
            </div>
            <div>
              <strong>3. Score quality</strong>
              <span>Profit, ROI, demand signals, low-risk shipping, reviews, and seasonal trend fit are ranked.</span>
            </div>
            <div>
              <strong>4. Stock queues</strong>
              <span>The best products refill niche pools, Product Listing, and Continuous Listing caches.</span>
            </div>
            <div>
              <strong>5. Guard publish</strong>
              <span>Listing time blocks unavailable Amazon items, duplicates, weak titles, bad pricing, and sparse images.</span>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Trending niches</span>
              <h2>What the source engine is stocking</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-trending-table">
              <thead>
                <tr>
                  <th>Niche</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Avg profit</th>
                  <th>Avg ROI</th>
                  <th>Score</th>
                  <th>Last refresh</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.sourceHealth.trendingNiches.length === 0 ? (
                  <tr><td colSpan={8}>No trending niche data yet. Run Deep Catalog Crawl to stock the first pools.</td></tr>
                ) : stats.sourceHealth.trendingNiches.map((niche) => (
                  <tr key={niche.name}>
                    <td>
                      <strong>{niche.name}</strong>
                      <span>{niche.missingImages} missing images · {niche.highRiskProducts} high risk</span>
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${niche.status === 'ready' ? 'good' : niche.status === 'watch' ? 'watch' : 'bad'}`}>
                        {niche.status === 'ready' ? 'Ready' : niche.status === 'watch' ? 'Needs stock' : 'Low'}
                      </span>
                    </td>
                    <td>
                      <strong>{formatNumber(niche.activeProducts)} source</strong>
                      <span>{formatNumber(niche.cacheProducts)} cache</span>
                    </td>
                    <td>{formatMoney(niche.averageProfit)}</td>
                    <td>{Math.round(niche.averageRoi || 0)}%</td>
                    <td>{Math.round(niche.averageScore || 0)}</td>
                    <td>{formatDateTime(niche.cacheRefreshedAt || niche.latestSeenAt)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={nicheAction !== null}
                        onClick={() => refreshNiche(niche.name)}
                      >
                        {nicheAction === `refresh:${niche.name}` ? 'Refreshing...' : 'Refresh niche'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-subtle-line">
            Ready means a niche has at least 30 active source products and 30 cached queue products with a recent refresh.
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>Manage source niches</span>
              <h2>Add or tune product search lanes</h2>
            </div>
          </div>
          <div className="admin-niche-manager">
            <div className="admin-niche-form">
              <label>
                <span>Niche name</span>
                <input
                  value={nicheForm.name}
                  onChange={(event) => setNicheForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Example: Pickleball Accessories"
                />
              </label>
              <label>
                <span>Search queries</span>
                <textarea
                  value={nicheForm.queries}
                  onChange={(event) => setNicheForm((current) => ({ ...current, queries: event.target.value }))}
                  placeholder={'pickleball paddle cover\npickleball ball holder\nportable pickleball net accessories'}
                  rows={7}
                />
              </label>
              <label>
                <span>Notes</span>
                <input
                  value={nicheForm.notes}
                  onChange={(event) => setNicheForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Why this niche matters right now"
                />
              </label>
              <button className="btn btn-solid btn-sm" disabled={nicheAction !== null} onClick={saveSourceNiche}>
                {nicheAction === 'save' ? 'Saving...' : 'Save source niche'}
              </button>
            </div>
            <div className="admin-managed-niches">
              {sourceNiches.length === 0 ? (
                <div className="admin-empty">No custom niches yet. Built-in trending niches are already active.</div>
              ) : sourceNiches.map((niche) => (
                <div key={niche.name} className="admin-managed-niche">
                  <div>
                    <strong>{niche.name}</strong>
                    <span>
                      {niche.queries.length} queries · {niche.active ? 'active' : 'paused'} · updated {formatDateTime(niche.updatedAt)}
                    </span>
                    {niche.notes ? <em>{niche.notes}</em> : null}
                  </div>
                  <div>
                    <button className="btn btn-ghost btn-sm" disabled={nicheAction !== null} onClick={() => editSourceNiche(niche)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" disabled={nicheAction !== null} onClick={() => setSourceNicheActive(niche.name, !niche.active)}>
                      {niche.active ? 'Pause' : 'Enable'}
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={nicheAction !== null} onClick={() => refreshNiche(niche.name)}>Refresh</button>
                  </div>
                </div>
              ))}
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
            <p className="admin-collab-source">
              {collabGitSha ? (
                <>
                  Deploy <code>{collabGitSha.slice(0, 7)}</code>
                </>
              ) : (
                <>
                  Deploy <code>unknown</code>
                </>
              )}
              {collabDeploymentId ? (
                <>
                  {' '}
                  · dpl <code>{collabDeploymentId}</code>
                </>
              ) : null}
              {collabFileMtime ? (
                <>
                  {' '}
                  · bundle mtime <code>{collabFileMtime}</code>
                </>
              ) : null}
            </p>
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
