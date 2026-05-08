'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EbayOrder, EbayShipToAddress, OrderAsinMap } from '../types'
import { fetchFulfillmentStatuses, getErrorMessage, startFulfillment } from '../api'
import { EmptyState, SectionIntro } from './shared'

function FulfillmentAmazonSteps() {
  const steps = ['Sign in to Amazon (2FA if prompted).', 'At checkout, confirm ship-to matches eBay, then pay and place the order.']
  return (
    <ol
      style={{
        margin: '10px 0 0',
        paddingLeft: '18px',
        fontSize: '12px',
        color: 'var(--sil)',
        lineHeight: 1.65,
      }}
    >
      {steps.map((text) => (
        <li key={text} style={{ marginBottom: '6px' }}>
          {text}
        </li>
      ))}
    </ol>
  )
}

/** Always renders visible copy + download + install steps — must never ship as an empty box. */
function FulfillmentExtensionTip() {
  const zipFilename = 'stackpilot-fulfillment-extension.zip'
  return (
    <div
      className="card"
      style={{
        marginBottom: '20px',
        padding: '16px 20px',
        border: '1px solid rgba(56,189,248,0.28)',
        background: 'rgba(14,27,44,0.65)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--plat)',
          marginBottom: '10px',
        }}
      >
        Optional: Chrome / Edge autofill (desktop only)
      </div>
      <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.65 }}>
        Install once on your computer. It reads the secure token from the Amazon tab, stores the buyer address for checkout, and tries <strong>Buy Now</strong> + shipping fields when Amazon shows those screens. You still sign in, complete 2FA, and place the order.
      </div>

      <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
        <a
          className="btn btn-gold btn-sm"
          href={`/${zipFilename}`}
          download={zipFilename}
          style={{ textDecoration: 'none', fontWeight: 700 }}
        >
          Download extension (zip)
        </a>
        <span style={{ fontSize: '11px', color: 'var(--dim)', maxWidth: '420px', lineHeight: 1.5 }}>
          File: <code style={{ fontSize: '10px', color: 'rgba(148,212,255,0.85)' }}>/{zipFilename}</code>
        </span>
      </div>

      <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--plat)', fontWeight: 700 }}>Install in the browser</div>
      <ol
        style={{
          margin: '8px 0 0',
          paddingLeft: '18px',
          fontSize: '12px',
          color: 'var(--sil)',
          lineHeight: 1.7,
        }}
      >
        <li style={{ marginBottom: '6px' }}>
          <strong style={{ color: 'var(--plat)' }}>Unzip</strong> the download into a permanent folder (Chrome needs that folder to stay on disk).
        </li>
        <li style={{ marginBottom: '6px' }}>
          Open{' '}
          <code style={{ fontSize: '11px' }}>chrome://extensions</code> (Chrome) or <code style={{ fontSize: '11px' }}>edge://extensions</code> (Edge). Turn on{' '}
          <strong>Developer mode</strong>.
        </li>
        <li style={{ marginBottom: '6px' }}>
          Click <strong>Load unpacked</strong> and choose the unzipped folder. You should see <strong>StackPilot Fulfillment</strong> in the list.
        </li>
        <li>
          Come back here with a mapped ASIN and click <strong style={{ color: 'var(--gold)' }}>Fulfill</strong> — the Amazon tab will carry the token the extension needs.
        </li>
      </ol>

      <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(14,27,44,0.85)', border: '1px solid rgba(125,211,252,0.12)', fontSize: '11px', color: 'var(--dim)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--plat)' }}>Chrome toolbar:</strong> On the StackPilot site the extension may look dimmed — Chrome only “lights up” tools that inject into the open page. Autofill runs in the <strong>Amazon</strong> tab after you click{' '}
        <strong style={{ color: 'var(--gold)' }}>Fulfill</strong>. Reload the extension in chrome://extensions after updating the zip.
      </div>

      <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--dim)', lineHeight: 1.55 }}>
        If the download returns 404, run <code style={{ fontSize: '10px' }}>npm install</code> then <code style={{ fontSize: '10px' }}>npm run zip:ext</code> locally and refresh; your host must run the prebuild zip step so{' '}
        <code style={{ fontSize: '10px' }}>/public/{zipFilename}</code> exists.
      </div>
    </div>
  )
}

function FulfillmentPrimaryTip() {
  return (
    <div
      className="card"
      style={{
        marginBottom: '14px',
        padding: '16px 20px',
        border: '1px solid rgba(56,189,248,0.18)',
        background: 'rgba(14,27,44,0.5)',
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.65 }}>
        Works on <strong style={{ color: 'var(--plat)' }}>phone and laptop</strong>: click <strong style={{ color: 'var(--gold)' }}>Fulfill</strong> — we copy the buyer&apos;s ship-to and open Amazon on a secure link (same link the optional
        Chrome helper uses). Paste the address at checkout if the product page doesn&apos;t send you straight into shipping. <strong style={{ color: 'var(--plat)' }}>No install needed.</strong>
      </div>
      <FulfillmentAmazonSteps />
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
      ? 'Checkout ready — pay & place order'
      : state === 'PURCHASED'
        ? 'Marked purchased'
        : state === 'ISSUE'
          ? 'Finish checkout on Amazon'
          : state
  const color =
    state === 'PREFILLED'
      ? 'rgba(52,211,153,0.95)'
      : state === 'PURCHASED'
        ? 'rgba(251,191,36,0.95)'
        : state === 'ISSUE'
          ? 'rgba(148,212,255,0.85)'
          : 'var(--dim)'
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        color,
        marginTop: '6px',
      }}
    >
      {label}
    </div>
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
          <SectionIntro
            eyebrow="Operations"
            title="Fulfillment"
            subtitle="Connect eBay, then use Fulfill to copy ship-to and open Amazon."
          />
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
            Tap <strong style={{ color: 'var(--gold)' }}>Fulfill</strong> to copy the address and open Amazon. No browser extension required on your phone.
          </div>
        </div>
      ) : (
        <SectionIntro
          eyebrow="Operations"
          title="Fulfillment"
          subtitle="One tap: copy buyer address and open the Amazon listing — works on laptop and phone."
        />
      )}

      <div className="dashboard-section" style={{ padding: sectionPad, maxWidth: '1200px', display: 'flex', flexDirection: 'column' }}>
        {compact ? null : <FulfillmentPrimaryTip />}
        {compact ? null : <FulfillmentExtensionTip />}
        {fulfillErr ? (
          <div
            className="card"
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              border: '1px solid rgba(248,113,113,0.35)',
              color: 'var(--sil)',
              fontSize: '12px',
            }}
          >
            {fulfillErr}
          </div>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState connected={true} onConnect={() => {}} msg="No awaiting shipment orders right now." />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15,35,56,0.92)', borderBottom: '1px solid rgba(125,211,252,0.12)' }}>
                  {['Order', 'Item', 'ASIN', 'Ship to', 'Actions'].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        color: 'var(--plat)',
                        fontSize: '7.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0,
                        padding: '13px 16px',
                        textAlign: 'left',
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const title = row.order.lineItems?.[0]?.title || row.order.orderId
                  const qty = row.order.lineItems?.[0]?.quantity || 1
                  const line = row.shipToLines.join('\n')
                  const copyKey = `${row.order.orderId}:${row.legacyItemId || 'na'}`
                  const st = statusByKey[copyKey]

                  return (
                    <tr
                      key={copyKey}
                      style={{
                        background: index % 2 === 0 ? 'rgba(14,27,44,0.88)' : 'rgba(11,22,36,0.88)',
                        borderBottom: '1px solid rgba(125,211,252,0.08)',
                        verticalAlign: 'top',
                      }}
                    >
                      <td style={{ padding: '14px 16px', color: 'var(--txt)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700 }}>{row.order.orderId}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '10px', marginTop: '4px' }}>{new Date(row.order.creationDate).toLocaleDateString()}</div>
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--txt)', fontSize: '12px', minWidth: '240px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>{title}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '10px' }}>
                          Qty {qty}
                          {row.legacyItemId ? ` · Item ${row.legacyItemId}` : ''}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {row.asin ? (
                          <a href={row.amazonUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>
                            {row.asin}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--dim)' }} title="Map an ASIN in ASIN Lookup to open the product from Fulfill.">
                            Missing
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '11px', minWidth: '260px' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.5 }}>{line}</pre>
                      </td>

                      <td style={{ padding: '14px 16px', minWidth: '200px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                            {fulfillFlash === copyKey
                              ? row.amazonUrl
                                ? 'Copied · opened Amazon'
                                : 'Address copied'
                              : 'Fulfill'}
                          </button>
                          <StateBadge state={st} />

                          <button
                            type="button"
                            className="btn btn-gold btn-sm"
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
                            {copiedId === copyKey ? 'Copied' : 'Copy only'}
                          </button>

                          {!row.amazonUrl ? (
                            <span style={{ color: 'var(--dim)', fontSize: '11px', lineHeight: 1.45 }}>
                              Map the ASIN in <strong style={{ color: 'rgba(148,212,255,0.85)' }}>ASIN Lookup</strong> so Fulfill can open the Amazon product page.
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
