'use client'
import Link from 'next/link'

export default function Signup() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 700, color: 'var(--txt)', marginBottom: '12px' }}>
          Stack<span style={{ background: 'linear-gradient(135deg,var(--gold),var(--gld2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pilot</span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: '32px' }}>Private Beta</div>
        <div className="card" style={{ padding: '40px 32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>Signups are closed</div>
          <div style={{ fontSize: '14px', color: 'var(--sil)', lineHeight: 1.7, marginBottom: '28px' }}>
            StackPilot is currently in private beta. New accounts are not available yet.
          </div>
          <Link href="/login" className="btn btn-gold btn-full" style={{ display: 'flex' }}>
            Sign in to existing account
          </Link>
        </div>
      </div>
    </div>
  )
}
