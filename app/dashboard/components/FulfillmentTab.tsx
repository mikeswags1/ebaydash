'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EbayOrder, EbayShipToAddress, OrderAsinMap } from '../types'
import { EmptyState, SectionIntro } from './shared'
import { fetchFulfillmentStatuses, startFulfillment, type FulfillmentStatusRow } from '../api'

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

export function FulfillmentTab({
  connected,
  awaiting,
  orderAsinMap,
  onOpenSettings,
}: {
  connected: boolean
  awaiting: EbayOrder[]
  orderAsinMap: OrderAsinMap
  onOpenSettings: () => void
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [fulfillStatus, setFulfillStatus] = useState<Record<string, FulfillmentStatusRow>>({})
  const [startingKey, setStartingKey] = useState<string | null>(null)

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
        shipTo,
        shipToLines: formatted.lines,
      }
    })
  }, [awaiting, orderAsinMap])

  useEffect(() => {
    if (!connected) return
    const orderIds = rows.map((row) => row.order.orderId).filter(Boolean)
    if (orderIds.length === 0) return

    let cancelled = false
    void (async () => {
      try {
        const data = await fetchFulfillmentStatuses(orderIds)
        if (cancelled) return
        const map: Record<string, FulfillmentStatusRow> = {}
        for (const entry of data.rows || []) {
          const key = `${entry.order_id}:${entry.legacy_item_id || 'na'}`
          if (!map[key]) map[key] = entry
        }
        setFulfillStatus(map)
      } catch {
        // Non-blocking.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [connected, rows])

  function renderStateBadge(state?: FulfillmentStatusRow['state'] | null) {
    const resolved = state || 'NOT_STARTED'
    const tone =
      resolved === 'PREFILLED' ? { bg: 'rgba(16,185,129,0.10)', bd: 'rgba(16,185,129,0.28)', tx: '#34d399' } :
      resolved === 'PURCHASED' ? { bg: 'rgba(56,189,248,0.10)', bd: 'rgba(56,189,248,0.28)', tx: '#7dd3fc' } :
      resolved === 'ISSUE' ? { bg: 'rgba(232,63,80,0.12)', bd: 'rgba(232,63,80,0.25)', tx: 'var(--red)' } :
      { bg: 'rgba(255,255,255,0.05)', bd: 'rgba(255,255,255,0.10)', tx: 'rgba(148,212,255,0.55)' }

    return (
      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '8px', fontWeight: 700, letterSpacing: 0, background: tone.bg, border: `1px solid ${tone.bd}`, color: tone.tx }}>
        {resolved}
      </span>
    )
  }

  if (!connected) {
    return (
      <>
        <SectionIntro
          eyebrow="Operations"
          title="Fulfillment"
          subtitle="Copy the buyer ship-to address and the mapped ASIN while you place the Amazon order."
        />
        <div className="dashboard-section" style={{ padding: '0 52px 72px' }}>
          <EmptyState connected={false} onConnect={onOpenSettings} msg="Connect eBay in Settings to load your awaiting shipment queue." />
        </div>
      </>
    )
  }

  return (
    <>
      <SectionIntro
        eyebrow="Operations"
        title="Fulfillment"
        subtitle="Awaiting shipment orders with one-click copy of the buyer ship-to block for Amazon checkout."
      />

      <div className="dashboard-section" style={{ padding: '0 52px 72px', maxWidth: '1200px' }}>
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
                  const status = fulfillStatus[copyKey]

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
                        <div style={{ marginTop: '10px' }}>{renderStateBadge(status?.state || null)}</div>
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--txt)', fontSize: '12px', minWidth: '240px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>{title}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '10px' }}>
                          Qty {qty}{row.legacyItemId ? ` · Item ${row.legacyItemId}` : ''}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {row.asin ? (
                          <a href={row.amazonUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>
                            {row.asin}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--dim)' }}>Missing</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '11px', minWidth: '260px' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.5 }}>{line}</pre>
                      </td>

                      <td style={{ padding: '14px 16px', minWidth: '220px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button
                            className="btn btn-gold btn-sm"
                            disabled={!row.amazonUrl || startingKey === copyKey}
                            onClick={async () => {
                              if (!row.amazonUrl) return
                              setStartingKey(copyKey)
                              try {
                                const started = await startFulfillment({
                                  orderId: row.order.orderId,
                                  legacyItemId: row.legacyItemId || null,
                                  asin: row.asin || null,
                                  amazonUrl: row.amazonUrl,
                                  shipTo: row.shipTo,
                                })

                                window.open(started.fulfillUrl, '_blank', 'noreferrer')
                              } finally {
                                setStartingKey(null)
                              }
                            }}
                          >
                            {startingKey === copyKey ? 'Starting…' : 'Fulfill (auto-fill)'}
                          </button>

                          <button
                            className="btn btn-solid btn-sm"
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
                            {copiedId === copyKey ? 'Copied' : 'Copy ship-to'}
                          </button>

                          {row.asin ? (
                            <a className="btn btn-ghost btn-sm" href={row.amazonUrl} target="_blank" rel="noreferrer">
                              Open on Amazon
                            </a>
                          ) : (
                            <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Map ASIN in ASIN Lookup</span>
                          )}

                          {status?.state === 'ISSUE' && status.last_error ? (
                            <div style={{ color: 'var(--red)', fontSize: '11px', lineHeight: 1.4 }}>
                              {status.last_error}
                            </div>
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

