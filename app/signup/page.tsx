'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Signup() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Registration failed')
      setLoading(false)
      return
    }

    // Auto sign in after registration
    const login = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (login?.error) {
      router.push('/login')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', zIndex: 1,
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '32px' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 700, color: 'var(--txt)' }}>
              Ebay<span style={{ background: 'linear-gradient(135deg,var(--gold),var(--gld2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dash</span>
            </div>
          </Link>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '36px', fontWeight: 600, color: 'var(--txt)', marginBottom: '8px' }}>Create account</h1>
          <p style={{ color: 'var(--sil)', fontSize: '14px' }}>Start managing your eBay business professionally</p>
        </div>

        <div className="card" style={{ padding: '36px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '8px' }}>
                Your Name
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="John Smith" autoFocus
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters" required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(232,63,80,0.08)', border: '1px solid rgba(232,63,80,0.25)',
                borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)',
              }}>{error}</div>
            )}

            <button type="submit" className="btn btn-solid btn-full" style={{ marginTop: '4px' }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--dim)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
