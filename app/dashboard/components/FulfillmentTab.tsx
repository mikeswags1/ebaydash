'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EbayOrder, EbayShipToAddress, OrderAsinMap } from '../types'
import { fetchFulfillmentStatuses, getErrorMessage, startFulfillment } from '../api'
import { EmptyState, SectionIntro } from './shared'

/** Collapsible — keeps the tab calm while preserving full install docs. */
function FulfillmentExtensionTip() {
  const zipFilename = 'stackpilot-fulfillment-extension.zip'
  return (
    <details className="fulfillment-details">
      <summary>
        <span>Optional Chrome / Edge checkout helper</span>
        <span className="fulfillment-details__hint">Desktop · unzip &amp; load unpacked</span>
      </summary>
      <div className="fulfillment-details__body">
        <p>
          Autofill for shipping fields when Amazon shows checkout; uses the same secure token as <strong>Fulfill</strong>. You still sign in, complete 2FA, and place the order.
        </p>
        <div className="fulfillment-details__actions">
          <a className="btn btn-gold btn-sm" href={`/${zipFilename}`} download={zipFilename} style={{ textDecoration: 'none', fontWeight: 700 }}>
            Download zip
          </a>
          <span style={{ fontSize: '11px', color: 'var(--dim)' }}>
            <code style={{ fontSize: '10px', color: 'rgba(148,212,255,0.85)' }}>/{zipFilename}</code>
          </span>
        </div>
        <ol>
          <li>
            <strong style={{ color: 'var(--plat)' }}>Unzip</strong> into a permanent folder (Chrome keeps referencing it).
          </li>
          <li>
            Open <code style={{ fontSize: '11px' }}>chrome://extensions</code> or <code style={{ fontSize: '11px' }}>edge://extensions</code>, enable <strong>Developer mode</strong>.
          </li>
          <li>
            <strong>Load unpacked</strong> → choose the folder → <strong>StackPilot Fulfillment</strong> appears.
          </li>
          <li>
            Use <strong style={{ color: 'var(--gold)' }}>Fulfill</strong> here first so the Amazon tab receives the token.
          </li>
        </ol>
        <div className="fulfillment-details__note">
          <strong>Toolbar icon:</strong> May look inactive on StackPilot — autofill runs on the <strong>Amazon</strong> tab. Reload the extension after replacing the zip.
        </div>
        <div className="fulfillment-details__devhint">
          If the zip 404s locally, run <code style={{ fontSize: '10px' }}>npm run zip:ext</code> so <code style={{ fontSize: '10px' }}>/public/{zipFilename}</code> exists.
        </div>
      </div>
    </details>
  )
}

function FulfillmentPrimaryTip() {
  return (
    <div className="fulfillment-help-card">
      <h2 className="fulfillment-help-card__title">How it works</h2>
      <p className="fulfillment-help-card__lead">
        Tap <strong>Fulfill</strong> to copy the buyer&apos;s ship-to and open Amazon — works on <strong>phone and laptop</strong>. No extension required.
      </p>
      <ul className="fulfillment-steps">
        <li>Sign in on Amazon (2FA if prompted).</li>
        <li>Match ship-to to eBay at checkout, then pay and place the order.</li>
      </ul>
    </div>
  )
}

function formatShipTo(shipTo?: EbayShipToAddress | null) {
  if (!shipTo) return { oneLine: 'No ship-to address found.', lines: ['No ship-to address found.'] }

  const name = shipTo.fullName || ''
  const a = shipTo.contactAddress || {}
  const phone = shipTo.primaryPhone?.phoneNumber || ''
  const cityLine = [a.city, a.stateOrProvince, a.postalCode].filter(Boolean).join(', ').replace(/, ,/g, ',')
  const country = a.countryCode || ''

  const lines = [
    name,
    a.addressLine1 || '',
    a.addressLine2 || '',
    [cityLine, country].filter(Boolean).join(' '),
    phone ? `Phone: ${phone}` : '',
  ]
    .map((line) => String(line).trim())
    .filter(Boolean)

  return {
    oneLine: lines.slice(0, 2).join(' · '),
    lines,
  }
}

function getShipTo(order: EbayOrder) {
  return order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || null
}

function getLegacyItemId(order: EbayOrder) {
  return order.lineItems?.[0]?.legacyItemId ? String(order.lineItems[0].legacyItemId) : ''
}

function rowStatusKey(orderId: string, legacyItemId: string) {
  return `${orderId}:${legacyItemId || 'na'}`
}

function StateBadge({ state }: { state?: string }) {
  if (!state || state === 'NOT_STARTED') return null
  const label =
    state === 'PREFILLED'
      ? 'Checkout ready'
      : state === 'PURCHASED'
        ? 'Purchased'
        : state === 'ISSUE'
          ? 'Finish on Amazon'
          : state
  const pillClass =
    state === 'PREFILLED'
      ? 'fulfillment-status-pill fulfillment-status-pill--ok'
      : state === 'PURCHASED'
        ? 'fulfillment-status-pill fulfillment-status-pill--warn'
        : state === 'ISSUE'
          ? 'fulfillment-status-pill fulfillment-status-pill--muted'
          : 'fulfillment-status-pill fulfillment-status-pill--muted'
  return (
    <span className={pillClass} title={label}>
      {label}
    </span>
  )
}

export function FulfillmentTab({
  connected,
  awaiting,
  orderAsinMap,
  onOpenSettings,
  compact,
}: {
  connected: boolean
  awaiting: EbayOrder[]
  orderAsinMap: OrderAsinMap
  onOpenSettings: () => void
  compact?: boolean
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [fulfillFlash, setFulfillFlash] = useState<string | null>(null)
  const [statusByKey, setStatusByKey] = useState<Record<string, string>>({})
  const [fulfillErr, setFulfillErr] = useState<string | null>(null)

  const rows = useMemo(() => {
    return awaiting.map((order) => {
      const shipTo = getShipTo(order)
      const formatted = formatShipTo(shipTo)
      const legacyItemId = getLegacyItemId(order)
      const mapping = legacyItemId ? orderAsinMap[legacyItemId] : undefined
      const asin = mapping?.asin || ''

      return {
        order,
        legacyItemId,
        asin,
        amazonUrl: asin ? `https://www.amazon.com/dp/${asin}` : mapping?.amazonUrl || '',
        shipToLines: formatted.lines,
        rawShipTo: shipTo,
      }
    })
  }, [awaiting, orderAsinMap])

  const orderIdsKey = useMemo(() => awaiting.map((o) => o.orderId).sort().join('|'), [awaiting])

  useEffect(() => {
    if (!connected || !orderIdsKey) return
    let cancelled = false
    const load = async () => {
      try {
        const ids = orderIdsKey.split('|').filter(Boolean)
        const { rows: statusRows } = await fetchFulfillmentStatuses(ids)
        if (cancelled) return
        const next: Record<string, string> = {}
        for (const r of statusRows) {
          const k = rowStatusKey(r.order_id, r.legacy_item_id || '')
          next[k] = r.state
        }
        setStatusByKey(next)
      } catch {
        /* optional */
      }
    }
    void load()
    const interval = window.setInterval(load, 12_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [connected, orderIdsKey])

  const sectionPad = compact ? `0 var(--xpad) 48px` : '0 52px 72px'

  if (!connected) {
    return (
      <>
        {compact ? (
          <div style={{ padding: '20px var(--xpad) 12px' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 700, color: 'var(--txt)' }}>Fulfillment</div>
            <div style={{ fontSize: '12px', color: 'var(--sil)', marginTop: '6px', lineHeight: 1.5 }}>Connect eBay to load orders waiting to ship.</div>
          </div>
        ) : (
          <SectionIntro eyebrow="Operations" title="Fulfillment" subtitle="Connect eBay, then use Fulfill to copy ship-to and open Amazon." />
        )}
        <div className="dashboard-section" style={{ padding: sectionPad }}>
          <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect eBay in Settings to load your awaiting shipment queue." />
        </div>
      </>
    )
  }

  return (
    <>
      {compact ? (
        <div style={{ padding: '20px var(--xpad) 12px' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 700, color: 'var(--txt)' }}>Fulfillment</div>
          <div style={{ fontSize: '12px', color: 'var(--sil)', marginTop: '6px', lineHeight: 1.5 }}>
            Tap <strong style={{ color: 'var(--gold)' }}>Fulfill</strong> to copy the address and open Amazon. No extension required on your phone.
          </div>
        </div>
      ) : (
        <SectionIntro
          eyebrow="Operations"
          title="Fulfillment"
          subtitle="Copy buyer ship-to and jump to Amazon in one flow — desktop or mobile."
        />
      )}

      <div className="dashboard-section" style={{ padding: sectionPad, maxWidth: '1200px', display: 'flex', flexDirection: 'column' }}>
        {compact ? null : (
          <div className="fulfillment-help">
            <FulfillmentPrimaryTip />
            <FulfillmentExtensionTip />
          </div>
        )}

        {fulfillErr ? <div className="fulfillment-alert">{fulfillErr}</div> : null}

        {rows.length === 0 ? (
          <EmptyState connected={true} onConnect={() => {}} msg="No awaiting shipment orders right now." />
        ) : (
          <div className="fulfillment-table-wrap">
            <table className="fulfillment-table">
              <thead>
                <tr>
                  {['Order', 'Item', 'ASIN', 'Ship to', 'Actions'].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const title = row.order.lineItems?.[0]?.title || row.order.orderId
                  const qty = row.order.lineItems?.[0]?.quantity || 1
                  const line = row.shipToLines.join('\n')
                  const copyKey = `${row.order.orderId}:${row.legacyItemId || 'na'}`
                  const st = statusByKey[copyKey]

                  return (
                    <tr key={copyKey}>
                      <td style={{ color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                        <div className="fulfillment-table__order-id">{row.order.orderId}</div>
                        <div className="fulfillment-table__date">{new Date(row.order.creationDate).toLocaleDateString()}</div>
                      </td>

                      <td style={{ minWidth: '220px' }}>
                        <div className="fulfillment-table__title">{title}</div>
                        <div className="fulfillment-table__meta">
                          Qty {qty}
                          {row.legacyItemId ? ` · Item ${row.legacyItemId}` : ''}
                        </div>
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        {row.asin ? (
                          <span className="fulfillment-table__asin">
                            <a href={row.amazonUrl} target="_blank" rel="noreferrer">
                              {row.asin}
                            </a>
                          </span>
                        ) : (
                          <span className="fulfillment-table__asin-missing" title="Map an ASIN in ASIN Lookup to open the product from Fulfill.">
                            Missing
                          </span>
                        )}
                      </td>

                      <td>
                        <pre className="fulfillment-table__address">{line}</pre>
                      </td>

                      <td>
                        <div className="fulfillment-queue-actions">
                          <button
                            type="button"
                            className="btn btn-solid btn-sm"
                            onClick={async () => {
                              setFulfillErr(null)
                              try {
                                await navigator.clipboard.writeText(line)
                                if (row.amazonUrl) {
                                  try {
                                    const r = await startFulfillment({
                                      orderId: row.order.orderId,
                                      legacyItemId: row.legacyItemId || null,
                                      asin: row.asin || null,
                                      amazonUrl: row.amazonUrl,
                                      shipTo: row.rawShipTo ?? {},
                                    })
                                    window.open(r.fulfillUrl, '_blank', 'noreferrer')
                                  } catch (err) {
                                    setFulfillErr(getErrorMessage(err, 'Could not start assist link. Opened Amazon without token.'))
                                    window.open(row.amazonUrl, '_blank', 'noreferrer')
                                  }
                                }
                                setFulfillFlash(copyKey)
                                window.setTimeout(() => {
                                  setFulfillFlash((prev) => (prev === copyKey ? null : prev))
                                }, 2600)
                              } catch {
                                setFulfillFlash(null)
                              }
                            }}
                          >
                            {fulfillFlash === copyKey ? (row.amazonUrl ? 'Copied · opened Amazon' : 'Address copied') : 'Fulfill'}
                          </button>

                          <StateBadge state={st} />

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ alignSelf: 'flex-start', fontSize: '11px' }}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(line)
                                setCopiedId(copyKey)
                                window.setTimeout(() => setCopiedId((prev) => (prev === copyKey ? null : prev)), 1400)
                              } catch {
                                setCopiedId(null)
                              }
                            }}
                          >
                            {copiedId === copyKey ? 'Copied address' : 'Copy address only'}
                          </button>

                          {!row.amazonUrl ? (
                            <span className="fulfillment-queue-actions__hint">
                              Map ASIN in <strong style={{ color: 'rgba(148,212,255,0.85)' }}>ASIN Lookup</strong> to open Amazon from here.
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
