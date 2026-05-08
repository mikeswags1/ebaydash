import type { FinderProduct, ListProgress } from '../types'
import { FinderResults } from './ProductListingTab'
import { SectionIntro } from './shared'

export function ContinuousListingTab({
  finderLoading,
  finderResults,
  finderError,
  finderView,
  onFinderViewChange,
  onFindProducts,
  onOpenListModal,
  onListAll,
  listAllProgress,
  connected,
}: {
  finderLoading: boolean
  finderResults: FinderProduct[] | null
  finderError: string | null
  finderView: 'cards' | 'list'
  onFinderViewChange: (view: 'cards' | 'list') => void
  onFindProducts: () => void
  onOpenListModal: (product: FinderProduct) => void
  onListAll: () => void
  listAllProgress: ListProgress | null
  connected: boolean
}) {
  const hasResults = Boolean(finderResults?.length)

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="StackPilot / Queue" title="Continuous Listing" />

      <div style={{ padding: '0 var(--xpad) 44px' }}>
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
            eBay is not connected yet. Publishing stays disabled until you reconnect your seller account in Settings.
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px', marginBottom: '24px' }}>
          <button className="btn btn-gold" disabled={finderLoading} onClick={onFindProducts} style={{ padding: '14px', fontSize: '13px' }}>
            {finderLoading ? (hasResults ? 'Shuffling...' : 'Building Queue...') : hasResults ? 'Shuffle Queue' : 'Load 30 Products'}
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

        {finderLoading && hasResults ? (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', fontSize: '12px', color: 'var(--sil)', lineHeight: 1.5 }}>
            Refreshing the queue. You can keep reviewing the products already shown.
          </div>
        ) : null}

        {finderLoading && !hasResults ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Building a fresh product queue...</div>
            <div style={{ fontSize: '11px', color: 'var(--dim)', opacity: 0.8 }}>Pulling a fast randomized batch from the warm product pool.</div>
          </div>
        ) : null}

        {finderResults && finderResults.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)' }}>No products met the current profit criteria.</div>
          </div>
        ) : null}

        {finderResults && finderResults.length > 0 ? (
          <FinderResults
            connected={connected}
            niche="Random Queue"
            results={finderResults}
            view={finderView}
            onViewChange={onFinderViewChange}
            onOpenListModal={onOpenListModal}
            onListAll={onListAll}
            listAllProgress={listAllProgress}
          />
        ) : null}
      </div>
    </div>
  )
}
