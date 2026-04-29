import { SectionIntro } from './shared'

export function SettingsTab({
  connected,
  needsReconnect,
  amazonConnected,
  amazonSellerId,
  niche,
  nicheSaved,
  onSync,
  onDisconnectEbay,
  disconnectingEbay,
  onOpenProductTab,
}: {
  connected: boolean
  needsReconnect: boolean
  amazonConnected: boolean
  amazonSellerId: string | null
  niche: string | null
  nicheSaved: boolean
  onSync: () => void
  onDisconnectEbay: () => void
  disconnectingEbay: boolean
  onOpenProductTab: () => void
}) {
  return (
    <div style={{ animation: 'fadein 0.22s ease' }}>
      <SectionIntro eyebrow="StackPilot / Configuration" title="Settings" />

      <div style={{ padding: '0 44px 44px', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          {connected ? (
            <>
              <StatusIcon tone="success" label="OK" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>eBay Connected</div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>Your eBay account is linked. Orders and listings can sync normally.</div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={onSync} className="btn btn-gold">
                  Sync Now
                </button>
                <a href="/api/ebay/connect" className="btn btn-ghost" style={{ fontSize: '12px' }}>
                  Reconnect eBay
                </a>
                <button
                  onClick={onDisconnectEbay}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', color: 'var(--red)', borderColor: 'rgba(248,81,101,0.28)' }}
                  disabled={disconnectingEbay}
                >
                  {disconnectingEbay ? 'Disconnecting...' : 'Disconnect eBay'}
                </button>
              </div>
            </>
          ) : (
            <>
              <StatusIcon tone="warning" label="eB" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>
                {needsReconnect ? 'Reconnect Your eBay Account' : 'Connect Your eBay Account'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>
                {needsReconnect
                  ? 'Your eBay session expired. Reconnect to restore order sync, listing, and dashboard actions.'
                  : 'Authorize your eBay account to load orders, sync listings, and publish products from the dashboard.'}
              </div>
              <a href="/api/ebay/connect" className="btn btn-solid" style={{ padding: '14px 36px', fontSize: '14px', display: 'inline-flex' }}>
                {needsReconnect ? 'Reconnect eBay Account' : 'Connect eBay Account'}
              </a>
              <div style={{ marginTop: '14px' }}>
                <a href="/api/ebay/connect?minimal=1" className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                  Try Basic eBay Connect
                </a>
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          {amazonConnected ? (
            <>
              <StatusIcon tone="success" label="AM" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>Amazon Connected</div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '8px', lineHeight: 1.7 }}>Your Amazon Seller account is linked. ASIN lookups can use your live catalog data.</div>
              {amazonSellerId ? <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--dim)', marginBottom: '24px' }}>Seller ID: {amazonSellerId}</div> : null}
              <a href="/api/amazon/connect" className="btn btn-ghost" style={{ fontSize: '12px' }}>
                Reconnect Amazon
              </a>
            </>
          ) : (
            <>
              <StatusIcon tone="warning" label="AM" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>Connect Amazon Seller Account</div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>
                Link Amazon so sourcing and fulfillment flows can rely on better product and seller data.
              </div>
              <a href="/api/amazon/connect" className="btn btn-solid" style={{ padding: '14px 36px', fontSize: '14px', display: 'inline-flex' }}>
                Connect Amazon Account
              </a>
            </>
          )}
        </div>

        {niche ? (
          <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: 'var(--sil)' }}>
              Active niche: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{niche}</span>
              {nicheSaved ? <span style={{ color: 'var(--grn)', marginLeft: '8px', fontSize: '11px' }}>Saved</span> : null}
            </div>
            <button onClick={onOpenProductTab} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
              Manage
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatusIcon({ tone, label }: { tone: 'success' | 'warning'; label: string }) {
  const background = tone === 'success' ? 'rgba(46,207,118,0.12)' : 'rgba(14,165,233,0.10)'
  const border = tone === 'success' ? '1px solid rgba(46,207,118,0.3)' : '1px solid rgba(14,165,233,0.25)'
  const color = tone === 'success' ? 'var(--grn)' : 'var(--gold)'

  return (
    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background, border, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '18px', color, fontWeight: 700 }}>
      {label}
    </div>
  )
}
