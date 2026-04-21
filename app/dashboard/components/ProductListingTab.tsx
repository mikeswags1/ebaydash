import type { FinderProduct, ListProgress } from '../types'
import { SectionIntro } from './shared'

const NICHE_GROUPS = [
  { group: 'Electronics', items: ['Phone Accessories', 'Computer Parts', 'Audio & Headphones', 'Smart Home Devices', 'Gaming Gear'] },
  { group: 'Home', items: ['Kitchen Gadgets', 'Home Decor', 'Furniture & Lighting', 'Cleaning Supplies', 'Storage & Organization'] },
  { group: 'Outdoors', items: ['Camping & Hiking', 'Garden & Tools', 'Sporting Goods', 'Fishing & Hunting', 'Cycling'] },
  { group: 'Health', items: ['Fitness Equipment', 'Personal Care', 'Supplements & Vitamins', 'Medical Supplies', 'Mental Wellness'] },
  { group: 'Automotive', items: ['Car Parts', 'Car Accessories', 'Motorcycle Gear', 'Truck & Towing', 'Car Care'] },
  { group: 'Lifestyle', items: ['Pet Supplies', 'Baby & Kids', 'Toys & Games', 'Clothing & Accessories', 'Jewelry & Watches'] },
  { group: 'Business', items: ['Office Supplies', 'Industrial Equipment', 'Safety Gear', 'Janitorial & Cleaning', 'Packaging Materials'] },
  { group: 'Collectibles', items: ['Trading Cards', 'Vintage & Antiques', 'Coins & Currency', 'Comics & Manga', 'Sports Memorabilia'] },
]

export function ProductListingTab({
  niche,
  nicheSaving,
  onSelectNiche,
  onClearNiche,
  finderLoading,
  finderResults,
  finderError,
  finderView,
  onFinderViewChange,
  onFindProducts,
  onOpenAsinLookup,
  onOpenScripts,
  onOpenListModal,
  onListAll,
  listAllProgress,
  connected,
}: {
  niche: string | null
  nicheSaving: boolean
  onSelectNiche: (niche: string) => void
  onClearNiche: () => void
  finderLoading: boolean
  finderResults: FinderProduct[] | null
  finderError: string | null
  finderView: 'cards' | 'list'
  onFinderViewChange: (view: 'cards' | 'list') => void
  onFindProducts: () => void
  onOpenAsinLookup: () => void
  onOpenScripts: () => void
  onOpenListModal: (product: FinderProduct) => void
  onListAll: () => void
  listAllProgress: ListProgress | null
  connected: boolean
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="EbayDash / Strategy" title="Product Listing" />

      <div style={{ padding: '0 44px 44px' }}>
        {niche ? (
          <div
            style={{
              marginBottom: '24px',
              padding: '16px 24px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg,rgba(200,162,80,0.10),rgba(220,185,100,0.04))',
              border: '1px solid rgba(200,162,80,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '4px' }}>
                Active Niche
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 600, color: 'var(--gld2)' }}>{niche}</div>
            </div>
            <button onClick={onClearNiche} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
              Change Niche
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: '36px', marginBottom: '24px' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>Choose Your Niche</div>
            <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.6 }}>
              Pick the category you want to sell in. This keeps sourcing and listing work focused and repeatable.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px' }}>
              {NICHE_GROUPS.map((group) => (
                <div key={group.group}>
                  <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--dim)', marginBottom: '8px' }}>
                    {group.group}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item}
                      onClick={() => onSelectNiche(item)}
                      disabled={nicheSaving}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        marginBottom: '4px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: '1px solid rgba(195,158,88,0.10)',
                        background: 'rgba(255,255,255,0.02)',
                        color: 'var(--sil)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {niche ? (
          <>
            {!connected ? (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(232,63,80,0.08)',
                  border: '1px solid rgba(232,63,80,0.18)',
                  fontSize: '12px',
                  color: 'var(--red)',
                  lineHeight: 1.6,
                }}
              >
                eBay is not connected yet. You can still source products, but publishing stays disabled until you reconnect your seller account in Settings.
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px', marginBottom: '24px' }}>
              <button className="btn btn-gold" disabled={finderLoading} onClick={onFindProducts} style={{ padding: '14px', fontSize: '13px' }}>
                {finderLoading ? 'Scanning Amazon...' : 'Find Products'}
              </button>
              <button className="btn btn-ghost" onClick={onOpenAsinLookup} style={{ padding: '14px', fontSize: '13px' }}>
                ASIN Lookup
              </button>
              <button className="btn btn-ghost" onClick={onOpenScripts} style={{ padding: '14px', fontSize: '13px' }}>
                Run Scripts
              </button>
              {finderResults && finderResults.length > 0 ? (
                <button
                  className="btn btn-solid"
                  style={{ padding: '14px', fontSize: '13px', fontWeight: 700 }}
                  disabled={!!listAllProgress && listAllProgress.done < listAllProgress.total}
                  onClick={onListAll}
                >
                  {listAllProgress && listAllProgress.done < listAllProgress.total ? `Listing ${listAllProgress.done + 1}/${listAllProgress.total}...` : `List All (${finderResults.length})`}
                </button>
              ) : null}
            </div>

            {finderError ? (
              <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(232,63,80,0.08)', border: '1px solid rgba(232,63,80,0.2)', fontSize: '13px', color: 'var(--red)' }}>
                {finderError}
              </div>
            ) : null}

            {finderLoading ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Scanning Amazon for profitable {niche} products...</div>
                <div style={{ fontSize: '11px', color: 'var(--dim)', opacity: 0.6 }}>Checking price, margin, and availability signals. This usually takes around 15 seconds.</div>
              </div>
            ) : null}

            {finderResults && finderResults.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--dim)' }}>No products met the current profit criteria for {niche}.</div>
              </div>
            ) : null}

            {finderResults && finderResults.length > 0 ? (
              <FinderResults
                connected={connected}
                niche={niche}
                results={finderResults}
                view={finderView}
                onViewChange={onFinderViewChange}
                onOpenListModal={onOpenListModal}
                onListAll={onListAll}
                listAllProgress={listAllProgress}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function FinderResults({
  connected,
  niche,
  results,
  view,
  onViewChange,
  onOpenListModal,
  onListAll,
  listAllProgress,
}: {
  connected: boolean
  niche: string
  results: FinderProduct[]
  view: 'cards' | 'list'
  onViewChange: (view: 'cards' | 'list') => void
  onOpenListModal: (product: FinderProduct) => void
  onListAll: () => void
  listAllProgress: ListProgress | null
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)' }}>
          {results.length} profitable products / {niche}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!listAllProgress ? (
            <button className="btn btn-gold btn-sm" style={{ fontSize: '10px' }} disabled={!connected} onClick={onListAll}>
              List All ({results.length})
            </button>
          ) : null}
          {listAllProgress && listAllProgress.done < listAllProgress.total ? (
            <div style={{ fontSize: '11px', color: 'var(--gold)', padding: '5px 12px', borderRadius: '8px', background: 'rgba(200,162,80,0.08)', border: '1px solid rgba(200,162,80,0.2)' }}>
              Listing {listAllProgress.done + 1}/{listAllProgress.total}...
            </div>
          ) : null}
          {listAllProgress && listAllProgress.done === listAllProgress.total ? (
            <div style={{ fontSize: '11px', color: 'var(--grn)', padding: '5px 12px', borderRadius: '8px', background: 'rgba(46,207,118,0.08)', border: '1px solid rgba(46,207,118,0.2)' }}>
              {listAllProgress.total - listAllProgress.errors} listed{listAllProgress.errors > 0 ? `, ${listAllProgress.errors} failed` : ''}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['cards', 'list'] as const).map((option) => (
              <button
                key={option}
                onClick={() => onViewChange(option)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  border: view === option ? '1px solid rgba(200,162,80,0.35)' : '1px solid rgba(195,158,88,0.12)',
                  background: view === option ? 'rgba(200,162,80,0.12)' : 'transparent',
                  color: view === option ? 'var(--gld2)' : 'var(--dim)',
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '14px' }}>
          {results.map((product) => (
            <div key={product.asin} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
                {product.imageUrl ? <img src={product.imageUrl} alt={product.title} style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} /> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt)', marginBottom: '4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.title}</div>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--dim)' }}>{product.asin}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {[
                  { label: 'Amazon', val: `$${product.amazonPrice.toFixed(2)}`, color: 'var(--txt)' },
                  { label: 'List at', val: `$${product.ebayPrice.toFixed(2)}`, color: 'var(--gld2)' },
                  { label: 'Profit', val: `$${product.profit.toFixed(2)}`, color: 'var(--grn)' },
                  { label: 'ROI', val: `${product.roi}%`, color: 'var(--grn)' },
                ].map((stat) => (
                  <div key={stat.label} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--dim)', marginBottom: '3px' }}>{stat.label}</div>
                    <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '15px', fontWeight: 800, color: stat.color }}>{stat.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <RiskBadge risk={product.risk} />
                  {product.salesVolume ? <span style={{ fontSize: '9px', color: 'var(--dim)' }}>Sales: {product.salesVolume}</span> : null}
                </div>
                <button onClick={() => onOpenListModal(product)} className="btn btn-gold btn-sm" style={{ fontSize: '10px' }}>
                  Review Listing
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
                {['Product', 'Amazon', 'List At', 'Profit', 'ROI', 'Sales', 'Risk', ''].map((heading) => (
                  <th key={heading} style={{ color: 'rgba(100,86,58,0.95)', fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '12px 14px', textAlign: heading === 'Product' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((product, index) => (
                <tr key={product.asin} style={{ background: index % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)', borderBottom: '1px solid rgba(195,158,88,0.06)' }}>
                  <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--dim)', marginTop: '2px' }}>{product.asin}</div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: '12px', color: 'var(--txt)' }}>${product.amazonPrice.toFixed(2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: '12px', color: 'var(--gld2)' }}>${product.ebayPrice.toFixed(2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: '12px', color: 'var(--grn)' }}>${product.profit.toFixed(2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: '12px', color: 'var(--grn)' }}>{product.roi}%</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{product.salesVolume || '-'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <RiskBadge risk={product.risk} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button onClick={() => onOpenListModal(product)} className="btn btn-gold btn-sm" style={{ fontSize: '10px', padding: '4px 10px' }}>
                      Review Listing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RiskBadge({ risk }: { risk: string }) {
  const tone = risk === 'LOW' ? 'var(--grn)' : risk === 'MEDIUM' ? 'var(--gold)' : 'var(--red)'
  const background = risk === 'LOW' ? 'rgba(46,207,118,0.10)' : risk === 'MEDIUM' ? 'rgba(200,162,80,0.10)' : 'rgba(232,63,80,0.10)'
  const border = risk === 'LOW' ? 'rgba(46,207,118,0.25)' : risk === 'MEDIUM' ? 'rgba(200,162,80,0.25)' : 'rgba(232,63,80,0.25)'

  return (
    <span style={{ fontSize: '8px', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, background, color: tone, border: `1px solid ${border}` }}>
      {risk}
    </span>
  )
}
