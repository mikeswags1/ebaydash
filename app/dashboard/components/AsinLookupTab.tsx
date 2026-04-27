import type { AsinResult, EbayOrder, OrderAsinMap } from '../types'

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
  onConfirmCurrent,
  onRejectCurrent,
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
  onConfirmCurrent: () => void
  onRejectCurrent: () => void
  manualSaving: boolean
  orders: EbayOrder[]
  orderAsinMap: OrderAsinMap
  onReset: () => void
}) {
  const untrackedOrders = orders.filter(o => {
    const itemId = o.lineItems?.[0]?.legacyItemId || ''
    return itemId && !orderAsinMap[itemId]?.asin
  })

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>

      {/* Header */}
      <div style={{ padding: '40px 44px 28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '8px' }}>
          EbayDash / Fulfillment
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '36px', fontWeight: 700, color: 'var(--txt)', lineHeight: 1.1, marginBottom: '10px' }}>
          Order Lookup
        </div>
        <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.6, maxWidth: '560px' }}>
          Someone bought your item — now find out exactly what to order on Amazon to ship it.
          Enter the eBay item ID and we'll find the matching Amazon product automatically.
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: '0 44px 28px' }}>
        <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--dim)', marginBottom: '12px' }}>
          How It Works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
          {[
            { step: '1', title: 'Get the eBay Item ID', desc: 'Open your eBay order and copy the item ID number (e.g. 387234561234). It\'s on every order page.' },
            { step: '2', title: 'Paste it below', desc: 'Enter the item ID in the search box and click Find Product. We\'ll match it to its Amazon source.' },
            { step: '3', title: 'Buy on Amazon', desc: 'Click the Amazon link, order it, then ship directly to your buyer. Done!' },
          ].map(s => (
            <div key={s.step} className="card" style={{ padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(200,162,80,0.14)', border: '1px solid rgba(200,162,80,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--gld2)', flexShrink: 0 }}>
                {s.step}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)', marginBottom: '4px' }}>{s.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 44px 44px', maxWidth: '720px' }}>

        {/* Search box */}
        <div className="card" style={{ padding: '28px 32px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt)', marginBottom: '4px' }}>
            Enter eBay Item ID
          </div>
          <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '14px' }}>
            Only numbers — found on the order details page on eBay under "Item number".
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              value={asinInput}
              onChange={e => onAsinInputChange(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' ? onLookup() : undefined}
              placeholder="e.g. 387234561234"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.08em' }}
            />
            <button onClick={onLookup} className="btn btn-gold" disabled={asinLoading || !asinInput.trim()}>
              {asinLoading ? 'Searching...' : 'Find Product'}
            </button>
          </div>

          {asinError ? (
            <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(232,63,80,0.07)', border: '1px solid rgba(232,63,80,0.20)' }}>
              <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '4px' }}>Couldn't find this item automatically</div>
              <div style={{ fontSize: '11px', color: 'var(--sil)', lineHeight: 1.6 }}>{asinError}</div>
            </div>
          ) : null}
        </div>

        {/* Result */}
        {asinResult ? (
          <>
            <div className="card" style={{ padding: '28px 32px', marginBottom: '16px' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--grn)', marginBottom: '14px' }}>
                ✓ Amazon Source Found
              </div>
              <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap' }}>
                {asinResult.imageUrl ? (
                  <img src={asinResult.imageUrl} alt={asinResult.title} style={{ width: '90px', height: '90px', objectFit: 'contain', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                ) : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt)', lineHeight: 1.4, marginBottom: '8px' }}>{asinResult.title}</div>
                  {asinResult.ebayTitle && asinResult.ebayTitle !== asinResult.title ? (
                    <div style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '8px', fontStyle: 'italic' }}>
                      Matched from: "{asinResult.ebayTitle.slice(0, 65)}..."
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--dim)', marginBottom: '2px' }}>Your Cost</div>
                      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '26px', fontWeight: 800, color: 'var(--gld2)' }}>
                        ${asinResult.amazonPrice.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(46,207,118,0.10)', border: '1px solid rgba(46,207,118,0.25)', fontSize: '10px', fontWeight: 700, color: 'var(--grn)' }}>
                      Ready to Order
                    </div>
                  </div>
                </div>
              </div>

              <a
                href={asinResult.amazonUrl || `https://www.amazon.com/dp/${asinResult.asin}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-gold"
                style={{ width: '100%', textAlign: 'center', fontSize: '14px', padding: '14px', textDecoration: 'none', display: 'block', fontWeight: 700 }}
              >
                Order on Amazon → Ship to Buyer
              </a>

              {/* Confirm/reject */}
              <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(195,158,88,0.10)' }}>
                <div style={{ fontSize: '11px', color: 'var(--sil)', marginBottom: '10px' }}>
                  Is this the right product? Confirming saves the link for future orders.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={onConfirmCurrent} className="btn btn-gold btn-sm" disabled={manualSaving}>Yes, that's it</button>
                  <button onClick={onRejectCurrent} className="btn btn-ghost btn-sm" disabled={asinLoading}>
                    {asinLoading ? 'Searching...' : 'Wrong product, try again'}
                  </button>
                </div>
              </div>
            </div>
            <button onClick={onReset} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
              ← Look up another order
            </button>
          </>
        ) : null}

        {/* Listed from another dashboard - manual entry guide */}
        {(asinError || (asinInput.trim() && !asinResult && !asinLoading)) ? (
          <div className="card" style={{ padding: '24px 28px', marginBottom: '20px', border: '1px solid rgba(200,162,80,0.18)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gld2)', marginBottom: '6px' }}>
              Listed from another tool?
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sil)', lineHeight: 1.7, marginBottom: '16px' }}>
              If this item was listed using a different dashboard or tool (not EbayDash), we won't have the Amazon ASIN saved automatically.
              No problem — find the Amazon product manually and paste its ASIN below. We'll save the link so future orders of this item are instant.
            </div>
            <div style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--sil)' }}>How to find an ASIN:</strong> Go to Amazon, find the product page, and look at the URL — it will contain <code style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>/dp/B0XXXXXXXXX</code>. That 10-character code is the ASIN.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={manualAsin}
                onChange={e => onManualAsinChange(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10))}
                placeholder="Paste ASIN (e.g. B08N5WRWNW)"
                style={{ flex: '1 1 200px', fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.08em' }}
              />
              <button
                onClick={onSaveManualMapping}
                className="btn btn-gold"
                disabled={manualSaving || !asinInput.trim() || manualAsin.length !== 10}
              >
                {manualSaving ? 'Saving...' : 'Save & Link'}
              </button>
            </div>
            {manualAsin.length > 0 && manualAsin.length < 10 ? (
              <div style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '6px' }}>
                ASIN must be exactly 10 characters — {10 - manualAsin.length} more to go
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Recent orders quick access */}
        {orders.length > 0 && !asinResult ? (
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)' }}>
                  Recent Orders — Quick Access
                </div>
                <div style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '3px' }}>
                  Click "Buy on Amazon" to fulfill instantly, or enter the item ID above for manual lookup
                </div>
              </div>
              {untrackedOrders.length > 0 ? (
                <div style={{ fontSize: '10px', color: 'var(--gold)', padding: '3px 10px', borderRadius: '20px', background: 'rgba(200,162,80,0.08)', border: '1px solid rgba(200,162,80,0.2)' }}>
                  {untrackedOrders.length} need linking
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '380px', overflowY: 'auto' }}>
              {orders.map(order => {
                const item = order.lineItems?.[0]
                const itemId = item?.legacyItemId || ''
                const tracked = itemId ? orderAsinMap[itemId] : undefined
                const canFulfill = !!tracked?.asin

                return (
                  <div
                    key={order.orderId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      gap: '12px',
                      background: canFulfill ? 'rgba(200,162,80,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${canFulfill ? 'rgba(200,162,80,0.16)' : 'rgba(255,255,255,0.04)'}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                        {item?.title?.slice(0, 65) || order.orderId}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--dim)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{order.buyer?.username} · {new Date(order.creationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {itemId ? <span style={{ fontFamily: 'monospace', color: 'rgba(200,162,80,0.5)' }}>#{itemId}</span> : null}
                        {!canFulfill ? <span style={{ color: 'var(--gold)' }}>Not linked yet — enter item ID above</span> : null}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '12px' }}>
                        ${parseFloat(order.pricingSummary?.total?.value || '0').toFixed(2)}
                      </div>
                      {canFulfill ? (
                        <a
                          href={tracked?.amazonUrl || `https://www.amazon.com/dp/${tracked?.asin}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-gold btn-sm"
                          style={{ fontSize: '10px', padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          Buy on Amazon
                        </a>
                      ) : (
                        <button
                          onClick={() => onAsinInputChange(itemId)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '10px', padding: '5px 12px', whiteSpace: 'nowrap' }}
                        >
                          Look Up
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

      </div>
    </div>
  )
}
