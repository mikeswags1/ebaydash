'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function usePoolRefresh() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const trigger = async (mode: 'catalog' | 'sourceOnly') => {
    setState('running')
    setMsg(mode === 'catalog' ? 'Deep catalog crawl running — this takes 3–5 minutes...' : 'Quick refresh running...')
    try {
      const res = await fetch('/api/admin/refresh-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const data = await res.json()
      setState(res.ok ? 'done' : 'error')
      const r = data.result || {}
      const msg = res.ok
        ? `Done. ${r.nichesRefreshed ?? 0} niches scraped, ${r.sourceProducts ?? 0} products in pool, ${r.continuousProducts ?? 0} in queue. Niches: ${(r.nichesAttempted || []).join(', ')}`
        : 'Error — check logs.'
      setMsg(msg)
    } catch { setState('error'); setMsg('Request failed.') }
  }
  return { state, msg, trigger }
}

type Customer = {
  id: number
  email: string
  name: string
  joined: string
  ebayConnected: boolean
  totalListings: number
  activeRecently: boolean
}

type Stats = {
  totalUsers: number
  ebayConnected: number
  activeRecently: number
  customers: Customer[]
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collab, setCollab] = useState<string>('')
  const pool = usePoolRefresh()

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status !== 'authenticated') return
    Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/collab').then(r => r.json()),
    ]).then(([statsData, collabData]) => {
      setStats(statsData)
      setCollab(collabData?.content || '')
      setLoading(false)
    }).catch(() => { setError('Failed to load.'); setLoading(false) })
  }, [status, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--sil)', fontSize: '14px' }}>
      Loading...
    </div>
  )

  if (error || !stats) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--red)', fontSize: '14px' }}>
      {error || 'Access denied.'}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 32px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '32px', fontWeight: 700, color: 'var(--txt)', marginBottom: '8px' }}>
          StackPilot Admin
        </div>
        <div style={{ fontSize: '13px', color: 'var(--sil)', marginBottom: '36px' }}>
          Signed in as {session?.user?.email}
        </div>

        {/* Product pool controls */}
        <div className="card" style={{ padding: '24px', marginBottom: '28px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sil)', marginBottom: '14px' }}>Product Pool</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-solid btn-sm" disabled={pool.state === 'running'} onClick={() => pool.trigger('catalog')}>
              {pool.state === 'running' ? 'Crawling...' : '🚀 Deep Catalog Crawl (100K products)'}
            </button>
            <button className="btn btn-gold btn-sm" disabled={pool.state === 'running'} onClick={() => pool.trigger('sourceOnly')}>
              Quick Refresh
            </button>
          </div>
          {pool.msg && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: pool.state === 'error' ? 'var(--red)' : pool.state === 'done' ? 'var(--grn)' : 'var(--gold)' }}>
              {pool.msg}
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '36px' }}>
          {[
            { label: 'Total Accounts', value: stats.totalUsers, color: 'var(--gold)' },
            { label: 'eBay Connected', value: stats.ebayConnected, color: 'var(--grn)' },
            { label: 'Active (30 days)', value: stats.activeRecently, color: 'var(--gld2)' },
          ].map(card => (
            <div key={card.label} className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sil)', marginBottom: '10px' }}>{card.label}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '42px', fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Customer table */}
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sil)', marginBottom: '12px' }}>
          All Accounts
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(125,211,252,0.12)' }}>
                {['Name', 'Email', 'Joined', 'eBay', 'Listings', 'Active'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.customers.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(125,211,252,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(125,211,252,0.02)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--txt)', fontWeight: 500 }}>{c.name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--sil)', fontFamily: 'monospace' }}>{c.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--dim)' }}>
                    {new Date(c.joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, background: c.ebayConnected ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)', color: c.ebayConnected ? 'var(--grn)' : 'var(--dim)', border: `1px solid ${c.ebayConnected ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      {c.ebayConnected ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--gold)', fontWeight: 600 }}>{c.totalListings}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, background: c.activeRecently ? 'rgba(56,189,248,0.10)' : 'transparent', color: c.activeRecently ? 'var(--gold)' : 'var(--dim)', border: `1px solid ${c.activeRecently ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                      {c.activeRecently ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* COLLAB.md live viewer */}
        {collab && (
          <div style={{ marginTop: '36px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sil)', marginBottom: '12px' }}>
              COLLAB.md — Live
            </div>
            <div className="card" style={{ padding: '28px', lineHeight: 1.75, fontSize: '13px', color: 'var(--sil)' }}>
              {collab.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <div key={i} style={{ fontSize: '22px', fontWeight: 800, color: 'var(--txt)', marginBottom: '18px', marginTop: i > 0 ? '10px' : 0 }}>{line.slice(2)}</div>
                if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '24px', marginBottom: '10px', borderBottom: '1px solid rgba(125,211,252,0.12)', paddingBottom: '6px' }}>{line.slice(3)}</div>
                if (line.startsWith('### ')) return <div key={i} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--plat)', marginTop: '14px', marginBottom: '6px' }}>{line.slice(4)}</div>
                if (line.startsWith('- **')) return <div key={i} style={{ padding: '6px 0 6px 16px', borderLeft: '2px solid rgba(125,211,252,0.25)', marginBottom: '4px' }} dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#dff7ff">$1</strong>').replace(/`([^`]+)`/g, '<code style="background:rgba(125,211,252,0.08);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>') }} />
                if (line.startsWith('| ') && line.includes(' | ')) {
                  const cells = line.split('|').filter(c => c.trim())
                  const isHeader = collab.split('\n')[i+1]?.includes('---')
                  if (line.includes('---')) return null
                  return <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: '8px', padding: '6px 8px', background: isHeader ? 'rgba(125,211,252,0.06)' : 'transparent', borderBottom: '1px solid rgba(125,211,252,0.06)', fontSize: '11px' }}>
                    {cells.map((cell, j) => <div key={j} style={{ color: isHeader ? 'var(--plat)' : 'var(--sil)', fontWeight: isHeader ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.trim()}</div>)}
                  </div>
                }
                if (line.trim() === '' || line.startsWith('---')) return <div key={i} style={{ height: '8px' }} />
                return <div key={i} style={{ marginBottom: '2px', color: 'var(--sil)' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#dff7ff">$1</strong>').replace(/`([^`]+)`/g, '<code style="background:rgba(125,211,252,0.08);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>') }} />
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
