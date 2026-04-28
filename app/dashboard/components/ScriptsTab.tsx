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
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="StackPilot / Automation" title="Scripts" />
      <div style={{ padding: '0 44px 44px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '18px' }}>
          {SCRIPT_CARDS.map((script) => {
            const isRunning = scriptRunning === script.file
            const isProductFinder = script.file === 'product-finder.js'
            const message = scriptMessage?.file === script.file ? scriptMessage : null

            return (
              <div key={script.file} className="card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)' }}>{script.title}</div>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(200,162,80,0.08)', color: 'var(--gold)', border: '1px solid rgba(200,162,80,0.2)' }}>
                    {script.badge}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px', fontFamily: 'monospace', opacity: 0.7 }}>{script.file}</div>
                <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '22px', lineHeight: 1.6 }}>{script.desc}</div>
                {message ? (
                  <div
                    style={{
                      marginBottom: '12px',
                      fontSize: '12px',
                      color: message.tone === 'success' ? 'var(--grn)' : message.tone === 'error' ? 'var(--red)' : 'var(--gold)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(195,158,88,0.12)',
                    }}
                  >
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
