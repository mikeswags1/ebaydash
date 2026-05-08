import { EBAY_FEE_RATE } from '../constants'
import type { FinderProduct, ListResult } from '../types'
import { getListingPreview } from '../utils'
import Image from 'next/image'

export function SellOnEbayModal({
  product,
  listPrice,
  onListPriceChange,
  validating,
  validated,
  listLoading,
  listResult,
  listError,
  onClose,
  onPublish,
}: {
  product: FinderProduct | null
  listPrice: string
  onListPriceChange: (value: string) => void
  validating: boolean
  validated: boolean
  listLoading: boolean
  listResult: ListResult | null
  listError: string | null
  onClose: () => void
  onPublish: () => Promise<void>
}) {
  if (!product) return null

  const preview = getListingPreview(listPrice, product.amazonPrice, '0', EBAY_FEE_RATE)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '14px',
          background: 'linear-gradient(160deg,rgba(18,32,50,0.98) 0%,rgba(11,22,36,0.98) 100%)',
          border: '1px solid rgba(125,211,252,0.18)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.42)',
          padding: '36px',
          animation: 'fadein 0.18s ease',
        }}
      >
        {listResult ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px', color: 'var(--grn)' }}>OK</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--grn)', marginBottom: '8px' }}>Listed on eBay</div>
            <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '24px' }}>Item #{listResult.listingId} is now live.</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <a href={listResult.listingUrl} target="_blank" rel="noreferrer" className="btn btn-gold" style={{ fontSize: '13px' }}>
                View Listing
              </a>
              <button onClick={onClose} className="btn btn-ghost btn-sm">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '24px' }}>
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  width={64}
                  height={64}
                  style={{
                    width: '64px',
                    height: '64px',
                    objectFit: 'contain',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(125,211,252,0.12)',
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <div>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--plat)', marginBottom: '6px' }}>Sell on eBay</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt)', lineHeight: 1.4 }}>{product.title.slice(0, 90)}</div>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--dim)', marginTop: '4px' }}>{product.asin}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.12)' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--sil)', marginBottom: '6px' }}>Amazon Cost</div>
                <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '22px', fontWeight: 800, color: 'var(--txt)' }}>${product.amazonPrice.toFixed(2)}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(14,165,233,0.22)' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--sil)', marginBottom: '4px' }}>Your eBay Price</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '18px', fontWeight: 700 }}>$</span>
                  <input value={listPrice} onChange={(event) => onListPriceChange(event.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Space Grotesk,sans-serif', fontSize: '22px', fontWeight: 800, color: 'var(--gld2)', padding: 0 }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: '10px', marginBottom: '20px' }}>
              <PreviewStat label="eBay Fee" value={`$${preview.ebayFee.toFixed(2)}`} tone="var(--dim)" />
              <PreviewStat label="Est. Profit" value={`$${preview.profit.toFixed(2)}`} tone={preview.profit >= 0 ? 'var(--grn)' : 'var(--red)'} />
              <PreviewStat label="ROI" value={`${preview.roi.toFixed(1)}%`} tone={preview.roi >= 0 ? 'var(--grn)' : 'var(--red)'} />
              <PreviewStat label="Margin" value={`${preview.margin.toFixed(1)}%`} tone={preview.margin >= 0 ? 'var(--gold)' : 'var(--red)'} />
            </div>

            <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', background: validated ? 'rgba(46,207,118,0.08)' : 'rgba(14,165,233,0.08)', border: validated ? '1px solid rgba(46,207,118,0.2)' : '1px solid rgba(14,165,233,0.18)', fontSize: '12px', color: validated ? 'var(--grn)' : 'var(--plat)', lineHeight: 1.6 }}>
              {validating
                ? 'Validating the exact Amazon product, current price, and images now. Publishing unlocks as soon as the live Amazon price is confirmed.'
                : validated
                  ? 'ASIN verified. This listing will use the validated Amazon title, image, and current cost data.'
                  : 'Amazon validation did not finish cleanly. Review the product again before publishing so the cost and profit stay accurate.'}
            </div>

            {listError ? (
              <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(232,63,80,0.08)', border: '1px solid rgba(232,63,80,0.2)', fontSize: '12px', color: 'var(--red)', lineHeight: 1.6 }}>
                {listError === 'RECONNECT_REQUIRED' ? (
                  <div>
                    Your eBay token has expired. Reconnect your account to continue.
                    <div style={{ marginTop: '10px' }}>
                      <a href="/api/ebay/connect" className="btn btn-gold btn-sm" style={{ fontSize: '11px', display: 'inline-flex' }}>
                        Reconnect eBay
                      </a>
                    </div>
                  </div>
                ) : listError.includes('usable source image') ? (
                  <div>
                    {listError}
                    <div style={{ marginTop: '8px', color: 'var(--dim)' }}>
                      Tip: run ASIN Lookup first or pick a sourcing result that includes a strong Amazon product image.
                    </div>
                  </div>
                ) : (
                  listError
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-gold" style={{ flex: 1, fontSize: '14px', padding: '14px' }} disabled={listLoading || validating || !validated || !listPrice} onClick={onPublish}>
                {listLoading ? 'Publishing...' : validating ? 'Validating Amazon Price...' : 'Publish to eBay'}
              </button>
              <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '13px', padding: '14px 18px' }}>
                Cancel
              </button>
            </div>
            <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--dim)', textAlign: 'center', lineHeight: 1.6 }}>
              Fixed price listing | Quantity 2 | New condition | Free shipping | 30-day returns
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PreviewStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.12)' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--sil)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '18px', fontWeight: 800, color: tone }}>{value}</div>
    </div>
  )
}
