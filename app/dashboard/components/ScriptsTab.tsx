import { useState } from 'react'
import type { ScriptMessage } from '../types'
import { SectionIntro } from './shared'

const SCRIPT_CARDS = [
  { title: 'Auto Feedback', file: 'auto-feedback.js', desc: 'Review post-order feedback automation guidance.', badge: 'Fulfillment' },
  { title: 'Optimize Titles', file: 'optimize-titles.js', desc: 'Analyze listing titles for search visibility improvements.', badge: 'SEO' },
  { title: 'Apply Title Changes', file: 'optimize-titles-apply.js', desc: 'Push approved title updates live to eBay.', badge: 'SEO' },
  { title: 'Check Orders', file: 'check-orders.js', desc: 'Audit order status and highlight items that need action.', badge: 'Operations' },
  { title: 'Fix Campaigns', file: 'fix-campaigns.js', desc: 'Review Promoted Listings campaign health.', badge: 'Ads' },
  { title: 'Delete Low ROI', file: 'delete-low-roi.js', desc: 'Flag listings that no longer meet margin requirements.', badge: 'Cleanup' },
  { title: 'Audit and Clean', file: 'audit-and-clean.js', desc: 'Run a broad inventory and listing quality pass.', badge: 'Cleanup' },
  { title: 'Product Finder', file: 'product-finder.js', desc: 'Open the sourcing workflow for profitable product research.', badge: 'Research' },
  { title: 'Delete Dead Listings', file: 'delete-dead-listings.js', desc: 'Review stale listings with no traction.', badge: 'Cleanup' },
  { title: 'Auto Lister', file: 'auto-lister.js', desc: 'Prepare bulk listing actions from product data.', badge: 'Automation' },
  { title: 'Update Descriptions', file: 'update-descriptions.js', desc: 'Refresh listing descriptions at scale.', badge: 'SEO' },
  { title: 'Sync Amazon Costs', file: 'sync-amazon-costs.js', desc: 'Recheck cost-of-goods against Amazon.', badge: 'Finance' },
]

export function ScriptsTab({
  scriptRunning,
  scriptMessage,
  onRunScript,
  onOpenProductFinder,
}: {
  scriptRunning: string | null
  scriptMessage: ScriptMessage | null
  onRunScript: (file: string) => Promise<void>
  onOpenProductFinder: () => void
}) {
  const [endState, setEndState] = useState<'idle' | 'confirm' | 'running' | 'done' | 'error'>('idle')
  const [endResult, setEndResult] = useState<{ ended?: number; failed?: number; message?: string } | null>(null)

  const handleEndAllListings = async () => {
    if (endState === 'idle') { setEndState('confirm'); return }
    if (endState !== 'confirm') return
    setEndState('running')
    try {
      const res = await fetch('/api/ebay/end-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })
      const data = await res.json()
      setEndResult({ message: data.message || (res.ok ? 'Done.' : 'Something went wrong.') })
      setEndState(res.ok ? 'done' : 'error')
    } catch {
      setEndState('error')
      setEndResult({ message: 'Request failed. Check your eBay connection.' })
    }
  }

  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="StackPilot / Automation" title="Scripts" />
      <div style={{ padding: `0 var(--xpad) 44px` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '18px' }}>

          {/* End All Listings — special destructive action */}
          <div className="card" style={{ padding: '28px', border: endState === 'confirm' ? '1px solid rgba(248,81,73,0.45)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)' }}>End All Listings</div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '8px', fontWeight: 700, background: 'rgba(248,81,73,0.10)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.28)' }}>
                Danger
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '22px', lineHeight: 1.6 }}>
              Immediately ends every active listing on your eBay account. Cannot be undone. Use this to do a full reset before re-listing with correct prices.
            </div>
            {endResult ? (
              <div style={{ marginBottom: '12px', fontSize: '12px', color: endState === 'done' ? 'var(--grn)' : 'var(--red)', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {endResult.message}
              </div>
            ) : endState === 'confirm' ? (
              <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--red)', padding: '8px 12px', borderRadius: '8px', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)' }}>
                ⚠ This will end every active listing. Click again to confirm.
              </div>
            ) : null}
            <button
              className={`btn btn-sm ${endState === 'confirm' ? 'btn-danger' : 'btn-ghost'}`}
              style={{ width: '100%', color: endState !== 'confirm' ? 'var(--red)' : undefined, borderColor: endState !== 'confirm' ? 'rgba(248,81,73,0.28)' : undefined }}
              disabled={endState === 'running' || endState === 'done'}
              onClick={handleEndAllListings}
            >
              {endState === 'running' ? 'Ending listings...' : endState === 'done' ? 'Done' : endState === 'confirm' ? '⚠ Confirm — End All Listings' : 'End All Listings'}
            </button>
            {endState === 'confirm' ? (
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '8px' }} onClick={() => setEndState('idle')}>
                Cancel
              </button>
            ) : null}
          </div>

          {SCRIPT_CARDS.map((script) => {
            const isRunning = scriptRunning === script.file
            const isProductFinder = script.file === 'product-finder.js'
            const message = scriptMessage?.file === script.file ? scriptMessage : null

            return (
              <div key={script.file} className="card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)' }}>{script.title}</div>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '8px', fontWeight: 700, letterSpacing: 0, background: 'rgba(14,165,233,0.08)', color: 'var(--plat)', border: '1px solid rgba(14,165,233,0.22)' }}>
                    {script.badge}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px', fontFamily: 'monospace', opacity: 0.7 }}>{script.file}</div>
                <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '22px', lineHeight: 1.6 }}>{script.desc}</div>
                {message ? (
                  <div style={{ marginBottom: '12px', fontSize: '12px', color: message.tone === 'success' ? 'var(--grn)' : message.tone === 'error' ? 'var(--red)' : 'var(--gold)', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(14,116,144,0.12)' }}>
                    {message.text}
                  </div>
                ) : null}
                <button
                  className="btn btn-gold btn-sm"
                  style={{ width: '100%' }}
                  disabled={isRunning}
                  onClick={() => (isProductFinder ? onOpenProductFinder() : onRunScript(script.file))}
                >
                  {isRunning ? 'Running...' : isProductFinder ? 'Open Product Finder' : 'Run Script'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
