import { SectionIntro } from './shared'
import type { ProductSourceHealth } from '../types'
import { useEffect, useState } from 'react'
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

const AUTO_BULK_NICHE_OPTIONS = [
  'Phone Accessories',
  'Computer Parts',
  'Audio & Headphones',
  'Smart Home Devices',
  'Gaming Gear',
  'Golf Accessories',
  'Pool Products',
  'Beach & Sunny Day',
  'Summer Outdoor Gear',
  'Backyard & Patio',
  'Travel Accessories',
  'Fitness Recovery',
  'Home Organization',
  'Pet Products',
  'Viral Gadgets',
  'Giftable Under $50',
  'Kitchen Gadgets',
  'Home Decor',
  'Furniture & Lighting',
  'Cleaning Supplies',
  'Storage & Organization',
  'Camping & Hiking',
  'Garden & Tools',
  'Sporting Goods',
  'Fishing & Hunting',
  'Cycling',
  'Fitness Equipment',
  'Personal Care',
  'Supplements & Vitamins',
  'Medical Supplies',
  'Mental Wellness',
  'Car Parts',
  'Car Accessories',
  'Motorcycle Gear',
  'Truck & Towing',
  'Car Care',
  'Pet Supplies',
  'Baby & Kids',
  'Toys & Games',
  'Clothing & Accessories',
  'Jewelry & Watches',
  'Office Supplies',
  'Industrial Equipment',
  'Safety Gear',
  'Janitorial & Cleaning',
  'Packaging Materials',
  'Trading Cards',
  'Vintage & Antiques',
  'Coins & Currency',
  'Comics & Manga',
  'Sports Memorabilia',
]

function BillingSection({
  compact,
  plan,
  status,
  listed,
  trialLimit,
  trialRemaining,
  checkoutAvailable,
  portalAvailable,
  ownerBillingBypass,
}: {
  compact?: boolean
  plan: string
  status: string
  listed: number
  trialLimit: number
  trialRemaining: number
  checkoutAvailable: boolean
  portalAvailable: boolean
  ownerBillingBypass: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isPro = plan === 'pro'
  const showUpgrade = !isPro
  const showPortal = isPro && portalAvailable
  const proButNoPortal = isPro && !portalAvailable && !ownerBillingBypass
  const remaining = Math.max(0, trialRemaining)
  const checkoutEnvironmentHint = !isPro && !checkoutAvailable
  const trialTotal = Math.max(1, trialLimit)
  const used = Math.min(Math.max(0, listed), trialTotal)
  const usedPct = Math.min(100, Math.round((used / trialTotal) * 100))

  return (
    <div className="card" style={{ padding: compact ? '20px 18px' : '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900, marginBottom: '8px' }}>
            Billing
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: compact ? '20px' : '22px', fontWeight: 700, color: 'var(--txt)' }}>
            {isPro ? 'StackPilot Pro' : `Free trial - ${used} / ${trialTotal} used · ${remaining} left`}
          </div>
        </div>
        <span style={{ padding: '5px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: isPro ? '#062014' : 'var(--sky)', background: isPro ? 'linear-gradient(135deg,#34d399,#f8d776)' : 'rgba(56,189,248,0.10)', border: isPro ? '1px solid rgba(248,215,118,0.45)' : '1px solid rgba(56,189,248,0.22)' }}>
          {isPro ? 'Pro' : 'Trial'}
        </span>
      </div>

      {!isPro ? (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ height: '8px', borderRadius: '999px', overflow: 'hidden', background: 'rgba(125,211,252,0.10)', border: '1px solid rgba(125,211,252,0.12)' }}>
            <div style={{ width: `${usedPct}%`, height: '100%', borderRadius: '999px', background: remaining > 0 ? 'linear-gradient(90deg,var(--sky),var(--grn))' : 'linear-gradient(90deg,var(--red),var(--gold))' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px', fontSize: '11px', color: 'var(--dim)', gap: '10px', flexWrap: 'wrap' }}>
            <span>{remaining} left</span>
            <span>{trialTotal} total trial listings</span>
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.65, marginBottom: '18px' }}>
        {isPro
          ? ownerBillingBypass
            ? `This account has full Pro access (operator plan). Stripe billing portal is not used for this login.`
            : `This account is on Pro${status && status !== 'active' ? ` (${status})` : ''}. Manage payment method, invoices, and cancellation in the Stripe billing portal.`
          : remaining > 0
            ? `This account has ${remaining} free listing${remaining === 1 ? '' : 's'} left. Trial usage is tied to total published listings on this account.`
            : 'Free trial complete for this account. Upgrade to keep listing with unlimited active listings.'}
      </div>

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

      {checkoutEnvironmentHint ? (
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--dim)', lineHeight: 1.55 }}>
          Checkout will open in Stripe. If this environment is missing billing keys, the button will show a setup error instead of hiding the upgrade path.
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
  billingOwnerBypass,
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
  billingOwnerBypass: boolean
}) {
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoErr, setAutoErr] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Array<{ id: number; label: string }>>([])
  const [autoSettings, setAutoSettings] = useState<AutoListingSettingsDto | null>(null)
  const [autoStatus, setAutoStatus] = useState<Awaited<ReturnType<typeof fetchAutoListingStatus>> | null>(null)
  const [autoNicheMenuOpen, setAutoNicheMenuOpen] = useState(false)

  const selectedAutoNiches = autoSettings?.allowed_niches?.filter(Boolean) ?? []
  const customAutoNiches = selectedAutoNiches.filter((nicheName) => !AUTO_BULK_NICHE_OPTIONS.includes(nicheName))
  const autoNicheOptions = [...customAutoNiches, ...AUTO_BULK_NICHE_OPTIONS]
  const selectedAutoNicheSet = new Set(selectedAutoNiches)
  const autoNicheLabel = selectedAutoNiches.length === 0
    ? 'All Niches'
    : selectedAutoNiches.length === 1
      ? selectedAutoNiches[0]
      : `${selectedAutoNiches.length} niches selected`
  const autoNicheSummary = selectedAutoNiches.length === 0
    ? 'Using all niches'
    : selectedAutoNiches.length <= 2
      ? `Focused on ${selectedAutoNiches.join(', ')}`
      : `Focused on ${selectedAutoNiches.length} niches`
  const queueCount = (autoStatus?.queue?.queued ?? 0) + (autoStatus?.queue?.retry ?? 0)
  const autoState = autoStatus?.enabled
    ? autoStatus?.emergency_stopped
      ? 'Stopped'
      : autoStatus?.paused
        ? 'Paused'
        : 'Running'
    : 'Off'
  const autoStateColor = autoState === 'Running' ? 'var(--grn)' : autoState === 'Stopped' ? 'var(--red)' : autoState === 'Paused' ? 'var(--gold)' : 'var(--dim)'

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

  const saveAutoNiches = (allowed_niches: string[]) => {
    const nextNiches = Array.from(new Set(allowed_niches.filter(Boolean)))
    setAutoSettings((s) => (s ? ({ ...s, allowed_niches: nextNiches }) : s))
    void saveAuto({ allowed_niches: nextNiches })
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
        <div className="card" style={{ padding: compact ? '22px 18px' : '28px' }}>
          {connected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <StatusIcon tone="success" label="OK" compact />
                  <div>
                    <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px' }}>eBay connection</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)' }}>Connected</div>
                    <div style={{ fontSize: '13px', color: 'var(--sil)', marginTop: '6px', lineHeight: 1.5 }}>Orders, financials, campaigns, and listing actions can sync normally.</div>
                  </div>
                </div>
                <span style={{ padding: '7px 12px', borderRadius: '999px', fontSize: '11px', color: 'var(--grn)', border: '1px solid rgba(46,207,118,0.28)', background: 'rgba(46,207,118,0.08)', fontWeight: 900, textTransform: 'uppercase' }}>Live</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '22px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <StatusIcon tone="warning" label="eB" compact />
                <div>
                  <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px' }}>eBay connection</div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)' }}>
                    {needsReconnect ? 'Reconnect eBay' : 'Connect eBay'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--sil)', marginTop: '6px', lineHeight: 1.5 }}>
                    {needsReconnect
                      ? 'Your eBay session expired. Reconnect to restore order sync, listing, and dashboard actions.'
                      : 'Authorize eBay to sync orders and publish listings from StackPilot.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '22px' }}>
                <a href="/api/ebay/connect" className="btn btn-solid" style={{ padding: '14px 28px', fontSize: '14px', display: 'inline-flex' }}>
                  {needsReconnect ? 'Reconnect eBay Account' : 'Connect eBay Account'}
                </a>
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
          ownerBillingBypass={billingOwnerBypass}
        />

        <div className="card" style={{ padding: compact ? '20px 18px' : '28px', overflow: 'visible' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div>
              <div style={{ color: 'var(--sky)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900, marginBottom: '8px' }}>
                Auto Bulk Listing
              </div>
              <div style={{ fontFamily: 'var(--serif)', color: 'var(--txt)', fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
                Listing autopilot
              </div>
              <div style={{ color: 'var(--sil)', fontSize: '13px', lineHeight: 1.55, maxWidth: '580px' }}>
                Controls how many approved products StackPilot can list, how fast it runs, and which product pool it can pull from. When enabled, Pro cron checks this account every 15 minutes.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '7px 12px', borderRadius: '999px', border: `1px solid ${autoStateColor === 'var(--dim)' ? 'rgba(125,211,252,0.16)' : autoStateColor}`, background: autoState === 'Running' ? 'rgba(46,207,118,0.08)' : autoState === 'Stopped' ? 'rgba(248,81,101,0.08)' : 'rgba(125,211,252,0.06)', color: autoStateColor, fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {autoLoading ? 'Loading' : autoState}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={Boolean(autoSettings?.enabled)}
                  disabled={autoLoading || autoSaving}
                  onChange={(e) => saveAuto({ enabled: e.target.checked, paused: false, emergency_stopped: false })}
                />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--txt)' }}>Enabled</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <SettingMetric label="Posted today" value={String(autoStatus?.postedToday ?? 0)} />
            <SettingMetric label="Ready queue" value={String(queueCount)} />
            <SettingMetric label="Avg score" value={String(Math.round(autoStatus?.avgScore ?? 0))} />
            <SettingMetric label="Est. profit" value={`$${Math.round(autoStatus?.estimatedDailyProfit ?? 0)}`} />
          </div>

          {autoErr ? (
            <div style={{ marginTop: '10px', color: 'var(--red)', border: '1px solid rgba(248,81,101,0.25)', background: 'rgba(248,81,101,0.08)', borderRadius: '10px', padding: '10px 12px', fontSize: '12px' }}>
              {autoErr}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '14px' }}>
            <Field label="Product pool">
              <div className="settings-multi-select">
                <button
                  type="button"
                  className="settings-select settings-multi-select__button"
                  disabled={autoLoading || autoSaving}
                  aria-haspopup="listbox"
                  aria-expanded={autoNicheMenuOpen}
                  onClick={() => setAutoNicheMenuOpen((open) => !open)}
                >
                  <span>{autoNicheLabel}</span>
                  <span aria-hidden="true">v</span>
                </button>
                {autoNicheMenuOpen ? (
                  <div className="settings-multi-select__menu" role="listbox" aria-multiselectable="true">
                    <label className={`settings-multi-select__option ${selectedAutoNiches.length === 0 ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedAutoNiches.length === 0}
                        disabled={autoLoading || autoSaving}
                        onChange={() => saveAutoNiches([])}
                      />
                      <span>All Niches</span>
                    </label>
                    {autoNicheOptions.map((option) => {
                      const checked = selectedAutoNicheSet.has(option)
                      return (
                        <label key={option} className={`settings-multi-select__option ${checked ? 'is-selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={autoLoading || autoSaving}
                            onChange={() => {
                              const nextNiches = checked
                                ? selectedAutoNiches.filter((nicheName) => nicheName !== option)
                                : [...selectedAutoNiches, option]
                              saveAutoNiches(nextNiches)
                            }}
                          />
                          <span>{option}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Mode">
              <select
                value={String(autoSettings?.mode || 'balanced')}
                onChange={(e) => saveAuto({ mode: e.target.value as AutoListingSettingsDto['mode'] })}
                className="settings-select"
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
                className="settings-select"
              >
                <option value="">Default</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <details className="settings-details">
            <summary>
              <span>Limits and filters</span>
              <span>{autoSettings?.listings_per_day ?? 100}/day - {autoSettings?.max_per_hour ?? 25}/hour - {autoSettings?.min_roi ?? 45}% ROI</span>
            </summary>
            <div className="settings-details__grid">
              <Field label="Listings / day">
                <input
                  value={String(autoSettings?.listings_per_day ?? 100)}
                  inputMode="numeric"
                  onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, listings_per_day: Number(e.target.value || 0) }) : s))}
                  onBlur={() => saveAuto({ listings_per_day: Number(autoSettings?.listings_per_day || 100) })}
                  className="settings-input"
                />
              </Field>
              <Field label="Max / hour">
                <input
                  value={String(autoSettings?.max_per_hour ?? 25)}
                  inputMode="numeric"
                  onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, max_per_hour: Number(e.target.value || 0) }) : s))}
                  onBlur={() => saveAuto({ max_per_hour: Number(autoSettings?.max_per_hour || 25) })}
                  className="settings-input"
                />
              </Field>
              <Field label="Cooldown (min)">
                <input
                  value={String(autoSettings?.cooldown_minutes ?? 3)}
                  inputMode="numeric"
                  onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, cooldown_minutes: Number(e.target.value || 0) }) : s))}
                  onBlur={() => saveAuto({ cooldown_minutes: Number(autoSettings?.cooldown_minutes || 3) })}
                  className="settings-input"
                />
              </Field>
              <Field label="Minimum ROI %">
                <input
                  value={String(autoSettings?.min_roi ?? 45)}
                  inputMode="numeric"
                  onChange={(e) => setAutoSettings((s) => (s ? ({ ...s, min_roi: Number(e.target.value || 0) }) : s))}
                  onBlur={() => saveAuto({ min_roi: Number(autoSettings?.min_roi || 45) })}
                  className="settings-input"
                />
              </Field>
            </div>
          </details>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', color: 'var(--dim)', fontSize: '12px' }}>
              <span>{autoNicheSummary}</span>
            </div>
          </div>
          <div style={{ marginTop: '12px', color: 'var(--dim)', fontSize: '12px', lineHeight: 1.55 }}>
            Automation only posts from the vetted queue. Pause stops new posts; Emergency stop turns Auto Bulk off immediately for this account.
          </div>
        </div>

        <ProductSourceHealthCard
          health={sourceHealth}
          loading={sourceHealthLoading}
          error={sourceHealthError}
          onRefresh={onRefreshSourceHealth}
        />

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

function SettingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '13px 14px', borderRadius: '12px', background: 'rgba(125,211,252,0.06)', border: '1px solid rgba(125,211,252,0.12)' }}>
      <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ color: 'var(--txt)', fontSize: '20px', fontWeight: 900, lineHeight: 1 }}>
        {value}
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
          <div style={{ fontFamily: 'var(--serif)', color: 'var(--txt)', fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
            Product pool readiness
          </div>
          <div style={{ color: 'var(--sil)', fontSize: '13px', lineHeight: 1.55, maxWidth: '620px' }}>
            Source depth, image coverage, cached category queues, and Continuous Listing stock.
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
                  <div style={{ color: 'var(--sil)', fontSize: '12px' }}>{formatNumber(niche.count)} ready</div>
                  <div style={{ color: 'var(--sky)', fontSize: '12px', fontWeight: 800 }}>Score {Math.round(niche.averageScore)}</div>
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--dim)', fontSize: '11px', lineHeight: 1.5, marginTop: '12px' }}>
              External API fallback: {health.providers.rapidApiConfigured ? 'enabled' : 'off'}.
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

function StatusIcon({ tone, label, compact }: { tone: 'success' | 'warning'; label: string; compact?: boolean }) {
  const background = tone === 'success' ? 'rgba(46,207,118,0.12)' : 'rgba(14,165,233,0.10)'
  const border = tone === 'success' ? '1px solid rgba(46,207,118,0.3)' : '1px solid rgba(14,165,233,0.25)'
  const color = tone === 'success' ? 'var(--grn)' : 'var(--gold)'
  const size = compact ? '48px' : '56px'

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background, border, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: compact ? 0 : '0 auto 18px', fontSize: compact ? '15px' : '18px', color, fontWeight: 700, flexShrink: 0 }}>
      {label}
    </div>
  )
}
