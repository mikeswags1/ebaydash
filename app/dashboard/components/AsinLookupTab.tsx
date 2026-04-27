import type { AsinResult, EbayOrder, OrderAsinMap } from '../types'
import { SectionIntro } from './shared'

export function AsinLookupTab({
  asinInput,
  onAsinInputChange,
  onLookup,
  asinLoading,
  asinError,
  asinResult,
  manualAsin,
  onManualAsinChange,
  onSaveManualMapping,
  manualSaving,
  orders,
  orderAsinMap,
  onReset,
}: {
  asinInput: string
  onAsinInputChange: (value: string) => void
  onLookup: () => void
  asinLoading: boolean
  asinError: string | null
  asinResult: AsinResult | null
  manualAsin: string
  onManualAsinChange: (value: string) => void
  onSaveManualMapping: () => void
  manualSaving: boolean
  orders: EbayOrder[]
  orderAsinMap: OrderAsinMap
  onReset: () => void
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro
        eyebrow="EbayDash / Fulfillment"
        title="Order Lookup"
        subtitle="Enter the eBay item ID from an order to find the matching Amazon product quickly."
      />

      <div style={{ padding: '0 44px 44px', maxWidth: '700px' }}>
        <div className="card" style={{ padding: '28px 32px', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--dim)', marginBottom: '4px' }}>
            eBay Item ID
          </div>
          <div style={{ fontSize: '10px', color: 'var(--dim)', opacity: 0.7, marginBottom: '14px' }}>
            The numeric item ID from the eBay order, for example `387234561234`.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              value={asinInput}
              onChange={(event) => onAsinInputChange(event.target.value.replace(/\D/g, ''))}
              onKeyDown={(event) => (event.key === 'Enter' ? onLookup() : undefined)}
              placeholder="e.g. 387234561234"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.08em' }}
            />
            <button onClick={onLookup} className="btn btn-gold" disabled={asinLoading || !asinInput.trim()}>
              {asinLoading ? 'Finding...' : 'Find Product'}
            </button>
          </div>
          {asinError ? <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--red)', lineHeight: 1.6 }}>{asinError}</div> : null}
        </div>

        {asinInput.trim() ? (
          <div className="card" style={{ padding: '22px 24px', marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--dim)', marginBottom: '8px' }}>
              Confirm Exact ASIN
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sil)', lineHeight: 1.6, marginBottom: '14px' }}>
              If auto-match misses an older listing, paste the correct Amazon ASIN here. The dashboard will validate it and save it for financials and fulfillment.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                value={manualAsin}
                onChange={(event) => onManualAsinChange(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10))}
                placeholder="Amazon ASIN"
                style={{ flex: '1 1 180px', fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.08em' }}
              />
              <button onClick={onSaveManualMapping} className="btn btn-gold" disabled={manualSaving || !asinInput.trim() || manualAsin.length !== 10}>
                {manualSaving ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </div>
        ) : null}

        {orders.length > 0 && !asinResult ? (
          <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '14px' }}>
              Recent Orders / Click to Fulfill
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
              {orders.map((order) => {
                const item = order.lineItems?.[0]
                const itemId = item?.legacyItemId || ''
                const trackedOrder = itemId ? orderAsinMap[itemId] : undefined
                const storedAsin = trackedOrder?.asin
                const canFulfill = !!storedAsin

                return (
                  <div
                    key={order.orderId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      gap: '12px',
                      background: canFulfill ? 'rgba(200,162,80,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${canFulfill ? 'rgba(200,162,80,0.18)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--txt)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                        {item?.title?.slice(0, 70) || order.orderId}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--dim)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>
                          {order.buyer?.username} / {new Date(order.creationDate).toLocaleDateString()}
                        </span>
                        {itemId ? <span style={{ fontFamily: 'monospace', color: 'rgba(200,162,80,0.6)' }}>#{itemId}</span> : null}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '13px' }}>
                        ${parseFloat(order.pricingSummary?.total?.value || '0').toFixed(2)}
                      </div>
                      {canFulfill ? (
                        <a
                          href={trackedOrder?.amazonUrl || `https://www.amazon.com/dp/${storedAsin}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-gold btn-sm"
                          style={{ fontSize: '10px', padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          Buy on Amazon
                        </a>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--dim)', opacity: 0.5 }}>Not tracked</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--dim)', opacity: 0.6, lineHeight: 1.6 }}>
              Works for all tracked listings. You can also enter any eBay item ID manually.
            </div>
          </div>
        ) : null}

        {asinResult ? (
          <>
            <div className="card" style={{ padding: '28px 32px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap' }}>
                {asinResult.imageUrl ? (
                  <img src={asinResult.imageUrl} alt={asinResult.title} style={{ width: '88px', height: '88px', objectFit: 'contain', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                ) : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: '6px' }}>
                    Amazon Source Product Found {asinResult.source === 'manual' ? '/ Confirmed' : ''}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt)', lineHeight: 1.4, marginBottom: '10px' }}>{asinResult.title}</div>
                  {asinResult.ebayTitle && asinResult.ebayTitle !== asinResult.title ? (
                    <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '10px', fontStyle: 'italic' }}>
                      Matched from eBay listing: "{asinResult.ebayTitle.slice(0, 70)}"
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--dim)', marginBottom: '3px' }}>
                        Amazon Cost
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '24px', fontWeight: 800, color: 'var(--gld2)' }}>
                        ${asinResult.amazonPrice.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--grn)' }}>
                        Ready to Buy
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <a
                href={asinResult.amazonUrl || `https://www.amazon.com/dp/${asinResult.asin}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-gold"
                style={{ width: '100%', textAlign: 'center', fontSize: '15px', padding: '14px', textDecoration: 'none', display: 'block', fontWeight: 700 }}
              >
                Buy on Amazon to Fulfill Order
              </a>
            </div>
            <button onClick={onReset} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
              Look up another order
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
