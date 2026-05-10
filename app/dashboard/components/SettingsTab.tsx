import { SectionIntro } from './shared'
import type { ProductSourceHealth } from '../types'
import { useEffect, useMemo, useState } from 'react'
import type { AutoListingSettingsDto } from '../api'
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  fetchAutoListingSettings,
  fetchAutoListingStatus,
  fetchEbayAccounts,
  saveAutoListingSettings,
  getErrorMessage,
} from '../api'

function BillingSection({
  compact,
  plan,
  status,
  listed,
  trialLimit,
  trialRemaining,
  checkoutAvailable,
  portalAvailable,
}: {
  compact?: boolean
  plan: string
  status: string
  listed: number
  trialLimit: number
  trialRemaining: number
  checkoutAvailable: boolean
  portalAvailable: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isPro = plan === 'pro'
  const showUpgrade = !isPro && checkoutAvailable
  const showPortal = isPro && portalAvailable
  const trialButStripeOff = !isPro && !checkoutAvailable
  const proButNoPortal = isPro && !portalAvailable
  const used = Math.min(Math.max(0, listed), Math.max(1, trialLimit))
  const remaining = Math.max(0, trialRemaining)

  return (
    <div className="card" style={{ padding: compact ? '22px 18px' : '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>
          Billing
        </div>
        <span style={{ padding: '5px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: isPro ? '#062014' : 'var(--sky)', background: isPro ? 'linear-gradient(135deg,#34d399,#f8d776)' : 'rgba(56,189,248,0.10)', border: isPro ? '1px solid rgba(248,215,118,0.45)' : '1px solid rgba(56,189,248,0.22)' }}>
          {isPro ? 'Pro' : 'Trial'}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: compact ? '20px' : '22px', fontWeight: 700, color: 'var(--txt)', marginBottom: '8px' }}>
        {isPro ? 'StackPilot Pro' : `Free trial - ${used} / ${Math.max(1, trialLimit)} used`}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.65, marginBottom: '18px' }}>
        {isPro
          ? `This account is on Pro${status && status !== 'active' ? ` (${status})` : ''}. Manage payment method, invoices, and cancellation in the Stripe billing portal.`
          : remaining > 0
            ? `This account has ${remaining} free listing${remaining === 1 ? '' : 's'} left. Upgrade to list beyond the free trial with unlimited active listings.`
            : 'Free trial complete for this account. Upgrade to keep listing with unlimited active listings.'}
      </div>

      {trialButStripeOff ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            lineHeight: 1.55,
            color: 'var(--dim)',
            border: '1px solid rgba(251,191,36,0.35)',
            background: 'rgba(251,191,36,0.08)',
          }}
        >
          Upgrade button is hidden until the server sees Stripe env vars. In Vercel add{' '}
          <strong style={{ color: 'var(--txt)' }}>STRIPE_SECRET_KEY</strong> and{' '}
          <strong style={{ color: 'var(--txt)' }}>STRIPE_PRICE_PRO</strong> for <strong>Production</strong>, then{' '}
          <strong style={{ color: 'var(--txt)' }}>Redeploy</strong>. Refresh this page after deploy.
        </div>
      ) : null}

      {proButNoPortal ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            lineHeight: 1.55,
            color: 'var(--dim)',
            border: '1px solid rgba(125,211,252,0.2)',
            background: 'rgba(56,189,248,0.06)',
          }}
        >
          Your account is marked Pro but there is no Stripe customer on file yet. Complete one checkout from this app, or ask support to link billing.
        </div>
      ) : null}

      {err ? (
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--red)', border: '1px solid rgba(248,81,101,0.25)', borderRadius: '10px', padding: '10px 12px' }}>
          {err}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: compact ? 'stretch' : 'flex-start' }}>
        {showUpgrade ? (
          <button
            type="button"
            className="btn btn-solid"
            disabled={busy}
            style={{ padding: '12px 22px', fontSize: '13px' }}
            onClick={async () => {
              setBusy(true)
              setErr(null)
              try {
                const { url } = await createStripeCheckoutSession()
                window.location.href = url
              } catch (e) {
                setErr(getErrorMessage(e, 'Unable to start checkout.'))
                setBusy(false)
              }
            }}
          >
            {busy ? 'Redirecting…' : 'Upgrade with Stripe'}
          </button>
        ) : null}
        {showPortal ? (
          <button
            type="button"
            className="btn btn-gold"
            disabled={busy}
            style={{ padding: '12px 22px', fontSize: '13px' }}
            onClick={async () => {
              setBusy(true)
              setErr(null)
              try {
                const { url } = await createStripePortalSession()
                window.location.href = url
              } catch (e) {
                setErr(getErrorMessage(e, 'Unable to open billing portal.'))
                setBusy(false)
              }
            }}
          >
            {busy ? 'Opening…' : 'Manage billing'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

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
  compact,
  subscriptionPlan,
  subscriptionStatus,
  trialListed,
  trialLimit,
  trialRemaining,
  billingCheckoutAvailable,
  billingPortalAvailable,
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
  compact?: boolean
  subscriptionPlan: string
  subscriptionStatus: string
  trialListed: number
  trialLimit: number
  trialRemaining: number
  billingCheckoutAvailable: boolean
  billingPortalAvailable: boolean
}) {
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoErr, setAutoErr] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Array<{ id: number; label: string }>>([])
  const [autoSettings, setAutoSettings] = useState<AutoListingSettingsDto | null>(null)
  const [autoStatus, setAutoStatus] = useState<Awaited<ReturnType<typeof fetchAutoListingStatus>> | null>(null)

  const allowedNichesText = useMemo(() => {
    const list = autoSettings?.allowed_niches || []
    return Array.isArray(list) ? list.join(', ') : ''
  }, [autoSettings])

  useEffect(() => {
    let alive = true
    setAutoLoading(true)
    Promise.all([fetchAutoListingSettings(), fetchAutoListingStatus(), fetchEbayAccounts()])
      .then(([s, st, accts]) => {
        if (!alive) return
        setAutoSettings(s.settings)
        setAutoStatus(st)
        setAccounts((accts.accounts || []).map((a) => ({ id: a.id, label: a.label })))
      })
      .catch((e) => {
        if (!alive) return
        setAutoErr(getErrorMessage(e, 'Unable to load Auto Bulk Listing settings.'))
      })
      .finally(() => { if (alive) setAutoLoading(false) })
    return () => { alive = false }
  }, [])

  const saveAuto = async (patch: Partial<AutoListingSettingsDto>) => {
    setAutoSaving(true)
    setAutoErr(null)
    try {
      const next = await saveAutoListingSettings(patch)
      setAutoSettings(next.settings)
      const st = await fetchAutoListingStatus()
      setAutoStatus(st)
    } catch (e) {
      setAutoErr(getErrorMessage(e, 'Unable to save Auto Bulk Listing settings.'))
    } finally {
      setAutoSaving(false)
    }
  }

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      {compact ? (
        <div style={{ padding: '22px var(--xpad) 12px' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 700, color: 'var(--txt)' }}>Settings</div>
          <div style={{ fontSize: '12px', color: 'var(--sil)', marginTop: '6px' }}>eBay connection and sourcing health.</div>
        </div>
      ) : (
        <SectionIntro eyebrow="StackPilot / Configuration" title="Settings" />
      )}

      <div style={{ padding: '0 var(--xpad) 44px', maxWidth: '980px', display: 'flex', flexDirection: 'column', gap: compact ? '14px' : '20px' }}>
        <div className="card" style={{ padding: compact ? '24px 18px' : '40px', textAlign: 'center' }}>
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

        <BillingSection
          compact={compact}
          plan={subscriptionPlan}
          status={subscriptionStatus}
          listed={trialListed}
          trialLimit={trialLimit}
          trialRemaining={trialRemaining}
          checkoutAvailable={billingCheckoutAvailable}
          portalAvailable={billingPortalAvailable}
        />

        <ProductSourceHealthCard
          health={sourceHealth}
          loading={sourceHealthLoading}
          error={sourceHealthError}
          onRefresh={onRefreshSourceHealth}
        />

        <div className="card" style={{ padding: compact ? '18px' : '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div>
              <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px' }}>
                Auto Bulk Listing
              </div>
              <div style={{ color: 'var(--sil)', fontSize: '13px', lineHeight: 1.6 }}>
                Drip-lists products throughout the day using your source pool and safety checks.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--dim)' }}>
                {autoStatus?.enabled ? (autoStatus?.paused ? 'Paused' : 'Running') : 'Off'}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={Boolean(autoSettings?.enabled)}
                  disabled={autoLoading || autoSaving}
                  onChange={(e) => saveAuto({ enabled: e.target.checked, paused: false, emergency_stopped: false })}
                />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--txt)' }}>Enable</span>
              </label>
            </div>
          </div>

          {autoErr ? (
            <div style={{ marginTop: '10px', color: 'var(--red)', border: '1px solid rgba(248,81,101,0.25)', background: 'rgba(248,81,101,0.08)', borderRadius: '10px', padding: '10px 12px', fontSize: '12px' }}>
              {autoErr}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px' }}>
            <Field label="Listings / day">
              <input
                value={String(autoSettings?.listings_per_day ?? 100)}
                inputMode="numeric"
                onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, listings_per_day: Number(e.target.value || 0) }) : s))}
                onBlur={() => saveAuto({ listings_per_day: Number(autoSettings?.listings_per_day || 100) })}
                className="pwa-orders__search-input"
              />
            </Field>
            <Field label="Max / hour">
              <input
                value={String(autoSettings?.max_per_hour ?? 25)}
                inputMode="numeric"
                onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, max_per_hour: Number(e.target.value || 0) }) : s))}
                onBlur={() => saveAuto({ max_per_hour: Number(autoSettings?.max_per_hour || 25) })}
                className="pwa-orders__search-input"
              />
            </Field>
            <Field label="Cooldown (min)">
              <input
                value={String(autoSettings?.cooldown_minutes ?? 3)}
                inputMode="numeric"
                onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, cooldown_minutes: Number(e.target.value || 0) }) : s))}
                onBlur={() => saveAuto({ cooldown_minutes: Number(autoSettings?.cooldown_minutes || 3) })}
                className="pwa-orders__search-input"
              />
            </Field>
            <Field label="Minimum ROI %">
              <input
                value={String(autoSettings?.min_roi ?? 45)}
                inputMode="numeric"
                onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, min_roi: Number(e.target.value || 0) }) : s))}
                onBlur={() => saveAuto({ min_roi: Number(autoSettings?.min_roi || 45) })}
                className="pwa-orders__search-input"
              />
            </Field>
            <Field label="Mode">
              <select
                value={String(autoSettings?.mode || 'balanced')}
                onChange={(e) => saveAuto({ mode: e.target.value as AutoListingSettingsDto['mode'] })}
                className="pwa-orders__search-input"
              >
                <option value="safe">Safe</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </Field>
            <Field label="eBay account">
              <select
                value={String(autoSettings?.selected_account_id ?? '')}
                onChange={(e) => saveAuto({ selected_account_id: e.target.value ? Number(e.target.value) : null })}
                className="pwa-orders__search-input"
              >
                <option value="">Default</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Allowed niches (comma separated)">
              <input
                value={allowedNichesText}
                onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, allowed_niches: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }) : s))}
                onBlur={() => saveAuto({ allowed_niches: autoSettings?.allowed_niches || [] })}
                className="pwa-orders__search-input"
                placeholder="Phone Accessories, Home Decor"
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!autoSettings?.enabled || autoSaving || autoLoading}
              onClick={() => saveAuto({ paused: !autoSettings?.paused })}
            >
              {autoSettings?.paused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--red)', borderColor: 'rgba(248,81,101,0.28)' }}
              disabled={autoSaving || autoLoading}
              onClick={() => saveAuto({ emergency_stopped: true, enabled: false, paused: true })}
            >
              Emergency stop
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--dim)' }}>Posted today</span>
              <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--txt)' }}>{autoStatus?.postedToday ?? 0}</span>
              <span style={{ fontSize: '12px', color: 'var(--dim)' }}>Queue</span>
              <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--txt)' }}>{(autoStatus?.queue?.queued ?? 0) + (autoStatus?.queue?.retry ?? 0)}</span>
            </div>
          </div>
        </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--dim)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
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
  const readyNicheLabel = health
    ? health.cache.totalNiches > 0 ? `${health.cache.readyNiches}/${health.cache.totalNiches}` : 'Direct'
    : '--'
  const readyNicheDetail = health?.cache.totalNiches
    ? `${formatNumber(health.cache.totalProducts)} cached products`
    : 'Finder reads source pool directly'

  return (
    <div className="card" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '22px' }}>
        <div>
          <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Product Source Health</div>
          <div style={{ color: 'var(--sil)', fontSize: '13px', lineHeight: 1.6 }}>
            Tracks source pool depth, niche cache readiness, and Continuous Listing stock.
          </div>
          <div style={{ color: 'var(--dim)', fontSize: '12px', lineHeight: 1.6, marginTop: '8px', maxWidth: '620px' }}>
            Source Pool is the big Amazon product warehouse. Niche Pools are saved 30-item category queues. Continuous Queue is the randomized ready-to-list pool. Crawling means StackPilot is adding fresh products in the background.
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
            <HealthMetric label="Niche Pools Ready" value={readyNicheLabel} detail={readyNicheDetail} />
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
