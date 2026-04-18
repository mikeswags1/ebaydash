'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

type Tab = 'overview' | 'orders' | 'financials' | 'scripts' | 'settings'

interface EbayOrder {
  orderId: string
  buyer: { username: string }
  pricingSummary: { total: { value: string; currency: string } }
  fulfillmentStartInstructions?: Array<{ shippingStep?: { shipTo?: { fullName?: string } } }>
  lineItems?: Array<{ title: string; quantity: number; lineItemCost: { value: string } }>
  orderFulfillmentStatus: string
  creationDate: string
}


export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('overview')
  const [orders, setOrders] = useState<EbayOrder[]>([])
  const [awaiting, setAwaiting] = useState<EbayOrder[]>([])
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncTime, setSyncTime] = useState<string | null>(null)
  const [niche, setNiche] = useState<string | null>(null)
  const [nicheSaving, setNicheSaving] = useState(false)
  const [nicheSaved, setNicheSaved] = useState(false)
  const [ebayMsg, setEbayMsg] = useState<string | null>(null)

  useEffect(() => {
    const ebay = searchParams.get('ebay')
    const msg = searchParams.get('msg')
    if (ebay === 'error') setEbayMsg(msg ? decodeURIComponent(msg) : 'eBay connection failed')
    if (ebay === 'connected') setEbayMsg('✓ eBay connected successfully')
  }, [searchParams])


  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const fetchOrders = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ebay/orders')
      const data = await res.json()
      if (data.connected) {
        setConnected(true)
        setOrders(data.recent || [])
        setAwaiting(data.awaiting || [])
        setSyncTime(new Date().toLocaleTimeString())
      } else {
        setConnected(false)
      }
    } catch { /* ignore */ }
    setSyncing(false)
  }, [])

  const loadCreds = useCallback(async () => {
    try {
      const res = await fetch('/api/ebay/credentials')
      const data = await res.json()
      if (data.credentials) {
        setConnected(!!data.credentials.has_token)
      }
    } catch { /* ignore */ }
  }, [])

  const loadNiche = useCallback(async () => {
    try {
      const res = await fetch('/api/user/niche')
      const data = await res.json()
      if (data.niche) setNiche(data.niche)
    } catch { /* ignore */ }
  }, [])

  const saveNiche = async (value: string) => {
    setNicheSaving(true)
    setNiche(value)
    try {
      await fetch('/api/user/niche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: value }),
      })
      setNicheSaved(true)
      setTimeout(() => setNicheSaved(false), 2000)
    } catch { /* ignore */ }
    setNicheSaving(false)
  }

  useEffect(() => {
    if (status === 'authenticated') {
      loadCreds()
      fetchOrders()
      loadNiche()
    }
  }, [status, fetchOrders, loadCreds, loadNiche])

  const grossRevenue = orders.reduce((s, o) => s + parseFloat(o.pricingSummary?.total?.value || '0'), 0)

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ color: 'var(--dim)', fontSize: '13px', letterSpacing: '0.1em' }}>Loading…</div>
      </div>
    )
  }

  const navItems: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'orders', label: 'Orders', icon: '📦' },
    { id: 'financials', label: 'Financials', icon: '📊' },
    { id: 'scripts', label: 'Scripts', icon: '⚡' },
    { id: 'settings', label: 'eBay Settings', icon: '🔗' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* SIDEBAR */}
      <aside style={{
        width: '260px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
        background: 'linear-gradient(170deg,rgba(14,10,5,1) 0%,rgba(10,7,3,1) 55%,rgba(7,5,2,1) 100%)',
        borderRight: '1px solid rgba(195,158,88,0.16)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '6px 0 90px rgba(0,0,0,0.97)',
      }}>
        {/* Brand */}
        <div style={{ padding: '32px 24px 28px', borderBottom: '1px solid rgba(195,158,88,0.10)', position: 'relative' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 700, color: 'var(--txt)', lineHeight: 1 }}>
            Ebay<span style={{ background: 'linear-gradient(135deg,var(--gold),var(--gld2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dash</span>
          </div>
          <div style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--dim)', marginTop: '6px', opacity: 0.7 }}>
            Operations Dashboard
          </div>
        </div>

        {/* Connection status */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(195,158,88,0.08)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
            borderRadius: '10px',
            background: connected ? 'rgba(46,207,118,0.06)' : 'rgba(90,80,55,0.08)',
            border: `1px solid ${connected ? 'rgba(46,207,118,0.18)' : 'rgba(90,80,55,0.18)'}`,
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: connected ? 'var(--grn)' : 'var(--dim)',
              boxShadow: connected ? '0 0 8px var(--grn)' : 'none',
              animation: connected ? 'glow-pulse 2.4s ease infinite' : 'none',
            }} />
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: connected ? 'var(--grn)' : 'var(--dim)' }}>
              {connected ? 'eBay Connected' : 'eBay Not Connected'}
            </span>
          </div>
        </div>

        {/* Niche badge */}
        {niche && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(195,158,88,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(200,162,80,0.06)', border: '1px solid rgba(200,162,80,0.14)' }}>
              <span style={{ fontSize: '11px' }}>◎</span>
              <div>
                <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--dim)', marginBottom: '2px' }}>Niche</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gold)' }}>{niche}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                border: tab === item.id ? '1px solid rgba(200,162,80,0.30)' : '1px solid transparent',
                background: tab === item.id ? 'linear-gradient(135deg,rgba(200,162,80,0.14),rgba(220,185,100,0.05))' : 'none',
                color: tab === item.id ? 'var(--gld2)' : 'var(--dim)',
                fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
                width: '100%', textAlign: 'left',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {tab === item.id && (
                <div style={{
                  position: 'absolute', left: '-1px', top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '55%',
                  background: 'linear-gradient(180deg,var(--gld2),var(--gold))',
                  borderRadius: '0 3px 3px 0',
                  boxShadow: '0 0 10px rgba(200,162,80,0.5)',
                }} />
              )}
              <span style={{ fontSize: '15px' }}>{item.icon}</span>
              {item.label}
              {item.id === 'orders' && awaiting.length > 0 && (
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: '20px',
                  fontSize: '8px', fontWeight: 700, background: 'rgba(232,63,80,0.12)',
                  color: 'var(--red)', border: '1px solid rgba(232,63,80,0.25)',
                }}>
                  {awaiting.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(195,158,88,0.10)' }}>
          <div style={{ fontSize: '11px', color: 'var(--sil)', marginBottom: '10px', fontWeight: 500 }}>
            {session?.user?.name || session?.user?.email}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="btn btn-ghost btn-sm btn-full"
            style={{ fontSize: '11px' }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* eBay status banner */}
        {ebayMsg && (
          <div style={{
            padding: '10px 44px', fontSize: '12px', fontWeight: 600,
            background: ebayMsg.startsWith('✓') ? 'rgba(46,207,118,0.10)' : 'rgba(232,63,80,0.10)',
            color: ebayMsg.startsWith('✓') ? 'var(--grn)' : 'var(--red)',
            borderBottom: ebayMsg.startsWith('✓') ? '1px solid rgba(46,207,118,0.2)' : '1px solid rgba(232,63,80,0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {ebayMsg}
            <button onClick={() => setEbayMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}>×</button>
          </div>
        )}

        {/* Topbar */}
        <header style={{
          height: '56px', background: 'rgba(12,9,4,0.96)', backdropFilter: 'blur(70px)',
          borderBottom: '1px solid rgba(195,158,88,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 44px', position: 'sticky', top: 0, zIndex: 200,
          boxShadow: '0 1px 40px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sil)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {navItems.find(n => n.id === tab)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {syncTime && <span style={{ fontSize: '10px', color: 'var(--dim)' }}>Synced {syncTime}</span>}
            <button
              onClick={fetchOrders}
              className="btn btn-gold btn-sm"
              disabled={syncing}
            >
              {syncing ? 'Syncing…' : '↻ Sync eBay'}
            </button>
          </div>
        </header>

        {/* PANES */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ animation: 'fadein 0.22s ease' }}>
              <div style={{ padding: '56px 52px 40px' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'var(--gold)', marginBottom: '14px', opacity: 0.85 }}>
                  EbayDash · Operations
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: 600, color: 'var(--txt)', lineHeight: 0.92, letterSpacing: '-0.015em', textShadow: '0 4px 80px rgba(200,162,80,0.18)' }}>
                  Overview
                </div>
              </div>

              {!connected && (
                <div style={{ margin: '0 44px 32px', padding: '28px 32px', borderRadius: '18px', background: 'rgba(200,162,80,0.05)', border: '1px solid rgba(200,162,80,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)', marginBottom: '6px' }}>Connect your eBay account</div>
                    <div style={{ fontSize: '13px', color: 'var(--sil)' }}>Add your eBay API credentials to start seeing your orders and analytics.</div>
                  </div>
                  <button onClick={() => setTab('settings')} className="btn btn-gold">
                    Connect eBay →
                  </button>
                </div>
              )}

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', padding: '0 44px 36px' }}>
                {[
                  { label: 'Awaiting Shipment', value: awaiting.length.toString(), color: awaiting.length > 0 ? 'var(--red)' : 'var(--grn)' },
                  { label: 'Total Orders', value: orders.length.toString(), color: 'var(--gold)' },
                  { label: 'Gross Revenue', value: `$${grossRevenue.toFixed(0)}`, color: 'var(--gld2)' },
                  { label: 'eBay Status', value: connected ? 'Live' : 'Offline', color: connected ? 'var(--grn)' : 'var(--dim)' },
                ].map(k => (
                  <div key={k.label} className="card" style={{ padding: '26px 24px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginBottom: '14px' }}>{k.label}</div>
                    <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '36px', fontWeight: 800, color: k.color, lineHeight: 1, letterSpacing: '-0.04em' }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Recent orders preview */}
              {orders.length > 0 && (
                <div style={{ padding: '0 44px 44px' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '16px' }}>Recent Orders</div>
                  <div className="card" style={{ overflow: 'hidden' }}>
                    {orders.slice(0, 5).map((o, i) => (
                      <div key={o.orderId} style={{
                        padding: '16px 24px', borderBottom: i < 4 ? '1px solid rgba(195,158,88,0.07)' : 'none',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
                      }}>
                        <div>
                          <div style={{ fontSize: '13px', color: 'var(--txt)', marginBottom: '3px' }}>{o.lineItems?.[0]?.title?.slice(0, 60) || o.orderId}</div>
                          <div style={{ fontSize: '11px', color: 'var(--dim)' }}>{o.buyer?.username} · {new Date(o.creationDate).toLocaleDateString()}</div>
                        </div>
                        <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '14px', flexShrink: 0 }}>
                          ${parseFloat(o.pricingSummary?.total?.value || '0').toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ORDERS ── */}
          {tab === 'orders' && (
            <div style={{ animation: 'fadein 0.22s ease' }}>
              <div style={{ padding: '56px 52px 40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'var(--gold)', marginBottom: '14px', opacity: 0.85 }}>
                    EbayDash · Live
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: 600, color: 'var(--txt)', lineHeight: 0.92, letterSpacing: '-0.015em', textShadow: '0 4px 80px rgba(200,162,80,0.18)' }}>
                    Order Management
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '42px', fontWeight: 800, color: awaiting.length > 0 ? 'var(--red)' : 'var(--grn)', lineHeight: 1, letterSpacing: '-0.04em' }}>{awaiting.length}</div>
                    <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginTop: '6px' }}>Need Action</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '42px', fontWeight: 800, color: 'var(--gld2)', lineHeight: 1, letterSpacing: '-0.04em' }}>${grossRevenue.toFixed(0)}</div>
                    <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dim)', marginTop: '6px' }}>Gross Revenue</div>
                  </div>
                </div>
              </div>

              {awaiting.length > 0 && (
                <div style={{ margin: '0 44px 24px' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} />
                    Awaiting Shipment ({awaiting.length})
                  </div>
                  <OrderTable orders={awaiting} />
                </div>
              )}

              <div style={{ padding: '0 44px 44px' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--dim)', marginBottom: '14px' }}>
                  All Orders ({orders.length})
                </div>
                {orders.length === 0 ? (
                  <EmptyState connected={connected} onConnect={() => setTab('settings')} msg="No orders found" />
                ) : (
                  <OrderTable orders={orders} />
                )}
              </div>
            </div>
          )}

          {/* ── FINANCIALS ── */}
          {tab === 'financials' && (
            <div style={{ animation: 'fadein 0.22s ease' }}>
              <div style={{ padding: '56px 52px 40px' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'var(--gold)', marginBottom: '14px', opacity: 0.85 }}>EbayDash · Analytics</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: 600, color: 'var(--txt)', lineHeight: 0.92, letterSpacing: '-0.015em', textShadow: '0 4px 80px rgba(200,162,80,0.18)' }}>Financials</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '0 44px 44px' }}>
                <FinCard title="Revenue Summary" rows={[
                  { label: 'Gross Revenue', value: `$${grossRevenue.toFixed(2)}` },
                  { label: 'Total Orders', value: orders.length.toString() },
                  { label: 'Average Order Value', value: orders.length ? `$${(grossRevenue / orders.length).toFixed(2)}` : '$0.00' },
                ]} />
                <FinCard title="Order Status" rows={[
                  { label: 'Awaiting Shipment', value: awaiting.length.toString() },
                  { label: 'Total Synced', value: orders.length.toString() },
                  { label: 'eBay Connection', value: connected ? 'Active' : 'Disconnected' },
                ]} />
              </div>
              {!connected && <EmptyState connected={false} onConnect={() => setTab('settings')} msg="Connect eBay to see financial analytics" style={{ margin: '0 44px 44px' }} />}
            </div>
          )}

          {/* ── SCRIPTS ── */}
          {tab === 'scripts' && (
            <div style={{ animation: 'fadein 0.22s ease' }}>
              <div style={{ padding: '56px 52px 40px' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'var(--gold)', marginBottom: '14px', opacity: 0.85 }}>EbayDash · Automation</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: 600, color: 'var(--txt)', lineHeight: 0.92, letterSpacing: '-0.015em', textShadow: '0 4px 80px rgba(200,162,80,0.18)' }}>Scripts</div>
              </div>
              <div style={{ padding: '0 44px 44px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '18px' }}>
                  {[
                    { title: 'Auto Feedback', file: 'auto-feedback.js', desc: 'Sends rotating feedback messages to buyers automatically after order completion.', badge: 'Fulfillment' },
                    { title: 'Optimize Titles', file: 'optimize-titles.js', desc: 'Rewrites eBay listing titles for better SEO and search visibility.', badge: 'SEO' },
                    { title: 'Apply Title Changes', file: 'optimize-titles-apply.js', desc: 'Pushes optimized title changes live to your eBay listings.', badge: 'SEO' },
                    { title: 'Check Orders', file: 'check-orders.js', desc: 'Audits order status across your store and flags items needing action.', badge: 'Operations' },
                    { title: 'Fix Campaigns', file: 'fix-campaigns.js', desc: 'Reviews and corrects underperforming eBay Promoted Listings campaigns.', badge: 'Ads' },
                    { title: 'Delete Low ROI', file: 'delete-low-roi.js', desc: 'Identifies and removes listings with consistently poor return on investment.', badge: 'Cleanup' },
                    { title: 'Audit & Clean', file: 'audit-and-clean.js', desc: 'Full store audit — removes duplicates, fixes broken listings, cleans inventory.', badge: 'Cleanup' },
                    { title: 'Product Finder', file: 'product-finder.js', desc: 'Discovers profitable products to source based on eBay demand data.', badge: 'Research' },
                    { title: 'Delete Dead Listings', file: 'delete-dead-listings.js', desc: 'Removes stale listings with zero views or sales over 60 days.', badge: 'Cleanup' },
                    { title: 'Auto Lister', file: 'auto-lister.js', desc: 'Bulk-creates new eBay listings from a product data source automatically.', badge: 'Automation' },
                    { title: 'Update Descriptions', file: 'update-descriptions.js', desc: 'Rewrites and improves item descriptions across all active listings.', badge: 'SEO' },
                    { title: 'Sync Amazon Costs', file: 'sync-amazon-costs.js', desc: 'Updates cost-of-goods from Amazon pricing to keep margins accurate.', badge: 'Finance' },
                  ].map(s => (
                    <div key={s.file} className="card" style={{ padding: '28px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)' }}>{s.title}</div>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(200,162,80,0.08)', color: 'var(--gold)', border: '1px solid rgba(200,162,80,0.2)' }}>{s.badge}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px', fontFamily: 'monospace', opacity: 0.7 }}>{s.file}</div>
                      <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '22px', lineHeight: 1.6 }}>{s.desc}</div>
                      <button className="btn btn-gold btn-sm" style={{ width: '100%' }}>Run Script</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <div style={{ animation: 'fadein 0.22s ease' }}>
              <div style={{ padding: '56px 52px 40px' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'var(--gold)', marginBottom: '14px', opacity: 0.85 }}>EbayDash · Configuration</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: 600, color: 'var(--txt)', lineHeight: 0.92, letterSpacing: '-0.015em', textShadow: '0 4px 80px rgba(200,162,80,0.18)' }}>eBay Account</div>
              </div>

              <div style={{ padding: '0 44px 44px', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* eBay connect card */}
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                  {connected ? (
                    <>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(46,207,118,0.12)', border: '1px solid rgba(46,207,118,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '24px' }}>✓</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>eBay Connected</div>
                      <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>Your eBay account is linked. Orders and data sync automatically.</div>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={fetchOrders} className="btn btn-gold">↻ Sync Now</button>
                        <a href="/api/ebay/connect" className="btn btn-ghost" style={{ fontSize: '12px' }}>Reconnect eBay</a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(200,162,80,0.10)', border: '1px solid rgba(200,162,80,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '24px' }}>🔗</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>Connect Your eBay Account</div>
                      <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '28px', lineHeight: 1.7 }}>
                        Click below and log in with your eBay account.<br />
                        Your orders sync instantly — no setup required.
                      </div>
                      <a href="/api/ebay/connect" className="btn btn-solid" style={{ padding: '14px 36px', fontSize: '14px', display: 'inline-flex' }}>
                        Connect eBay Account
                      </a>
                      <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '16px' }}>
                        You&apos;ll be redirected to eBay to authorize access. We never store your eBay password.
                      </div>
                    </>
                  )}
                </div>

                {/* Niche selector card */}
                <div className="card" style={{ padding: '36px' }}>
                  <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)', marginBottom: '6px' }}>Store Niche</div>
                      <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.6 }}>
                        Your niche focuses the Product Finder and scripts on the most relevant items for your store.
                      </div>
                    </div>
                    {nicheSaved && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--grn)', letterSpacing: '0.06em' }}>Saved ✓</span>
                    )}
                  </div>

                  <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                    {[
                      { group: 'Electronics', items: ['Phone Accessories', 'Computer Parts', 'Audio & Headphones', 'Smart Home Devices', 'Gaming Gear'] },
                      { group: 'Home', items: ['Kitchen Gadgets', 'Home Decor', 'Furniture & Lighting', 'Cleaning Supplies', 'Storage & Organization'] },
                      { group: 'Outdoors', items: ['Camping & Hiking', 'Garden & Tools', 'Sporting Goods', 'Fishing & Hunting', 'Cycling'] },
                      { group: 'Health', items: ['Fitness Equipment', 'Personal Care', 'Supplements & Vitamins', 'Medical Supplies', 'Mental Wellness'] },
                      { group: 'Automotive', items: ['Car Parts', 'Car Accessories', 'Motorcycle Gear', 'Truck & Towing', 'Car Care'] },
                      { group: 'Lifestyle', items: ['Pet Supplies', 'Baby & Kids', 'Toys & Games', 'Clothing & Accessories', 'Jewelry & Watches'] },
                      { group: 'Business', items: ['Office Supplies', 'Industrial Equipment', 'Safety Gear', 'Janitorial & Cleaning', 'Packaging Materials'] },
                      { group: 'Collectibles', items: ['Trading Cards', 'Vintage & Antiques', 'Coins & Currency', 'Comics & Manga', 'Sports Memorabilia'] },
                    ].map(group => (
                      <div key={group.group}>
                        <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--dim)', marginBottom: '6px', paddingLeft: '4px' }}>{group.group}</div>
                        {group.items.map(item => (
                          <button
                            key={item}
                            onClick={() => saveNiche(item)}
                            disabled={nicheSaving}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '8px 12px', marginBottom: '4px', borderRadius: '8px',
                              fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
                              border: niche === item ? '1px solid rgba(200,162,80,0.40)' : '1px solid rgba(195,158,88,0.10)',
                              background: niche === item ? 'linear-gradient(135deg,rgba(200,162,80,0.16),rgba(220,185,100,0.06))' : 'rgba(255,255,255,0.02)',
                              color: niche === item ? 'var(--gld2)' : 'var(--sil)',
                              fontWeight: niche === item ? 600 : 400,
                              transition: 'all 0.15s',
                            }}
                          >
                            {niche === item && <span style={{ marginRight: '6px', fontSize: '10px' }}>◆</span>}
                            {item}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )

}

function OrderTable({ orders }: { orders: EbayOrder[] }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(20,14,6,0.95)', borderBottom: '1px solid rgba(195,158,88,0.11)' }}>
            {['Item', 'Buyer', 'Total', 'Status', 'Date'].map(h => (
              <th key={h} style={{ color: 'rgba(100,86,58,0.95)', fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '13px 16px', textAlign: h === 'Item' ? 'left' : 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={o.orderId} style={{ background: i % 2 === 0 ? 'rgba(17,12,7,0.80)' : 'rgba(12,9,4,0.70)', borderBottom: '1px solid rgba(195,158,88,0.06)', transition: 'background 0.15s' }}>
              <td style={{ padding: '14px 16px', color: 'var(--txt)', fontSize: '13px', maxWidth: '300px' }}>
                {o.lineItems?.[0]?.title?.slice(0, 55) || o.orderId}
                {(o.lineItems?.[0]?.title?.length || 0) > 55 && '…'}
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--sil)', fontSize: '12px', textAlign: 'center' }}>{o.buyer?.username}</td>
              <td style={{ padding: '14px 16px', fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '13px', textAlign: 'center' }}>
                ${parseFloat(o.pricingSummary?.total?.value || '0').toFixed(2)}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.05em',
                  background: o.orderFulfillmentStatus === 'NOT_STARTED' ? 'rgba(232,63,80,0.12)' : 'rgba(46,207,118,0.10)',
                  color: o.orderFulfillmentStatus === 'NOT_STARTED' ? 'var(--red)' : 'var(--grn)',
                  border: `1px solid ${o.orderFulfillmentStatus === 'NOT_STARTED' ? 'rgba(232,63,80,0.25)' : 'rgba(46,207,118,0.22)'}`,
                }}>
                  {o.orderFulfillmentStatus === 'NOT_STARTED' ? 'Ship Now' : 'Fulfilled'}
                </span>
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--dim)', fontSize: '11px', textAlign: 'center' }}>
                {new Date(o.creationDate).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FinCard({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="card" style={{ padding: '32px' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--plat)', marginBottom: '24px' }}>{title}</div>
      {rows.map((r, i) => (
        <div key={r.label}>
          {i > 0 && <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(200,162,80,0.14),transparent)', margin: '8px 0' }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: '13px', color: 'var(--sil)' }}>{r.label}</span>
            <span style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, color: 'var(--gld2)', fontSize: '14px' }}>{r.value}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ connected, onConnect, msg, style: s }: { connected: boolean; onConnect: () => void; msg: string; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '60px', textAlign: 'center', borderRadius: '20px', border: '1px solid var(--bdr)', background: 'rgba(14,10,5,0.5)', ...s }}>
      <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: connected ? 0 : '16px' }}>{msg}</div>
      {!connected && <button onClick={onConnect} className="btn btn-gold btn-sm">Connect eBay →</button>}
    </div>
  )
}
