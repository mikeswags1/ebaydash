'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status !== 'authenticated') return
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => { setError('Failed to load stats.'); setLoading(false) })
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
      </div>
    </div>
  )
}
