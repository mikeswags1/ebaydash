import Link from 'next/link'

export default function Landing() {
  return (
    <main style={{ position: 'relative', zIndex: 1 }}>
      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 52px',
        background: 'rgba(8,6,3,0.92)', backdropFilter: 'blur(60px)',
        borderBottom: '1px solid rgba(195,158,88,0.12)',
      }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 700, color: 'var(--txt)', letterSpacing: '0.01em' }}>
          Ebay<span style={{ background: 'linear-gradient(135deg,var(--gold),var(--gld2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dash</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link href="/signup" className="btn btn-solid btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '120px 52px 80px',
        position: 'relative',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          padding: '6px 18px', borderRadius: '100px', marginBottom: '32px',
          background: 'rgba(200,162,80,0.08)', border: '1px solid rgba(200,162,80,0.22)',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--gold)',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--grn)', boxShadow: '0 0 8px var(--grn)', display: 'inline-block' }} />
          Live eBay Operations Platform
        </div>

        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 'clamp(52px,7vw,88px)',
          fontWeight: 600, color: 'var(--txt)', lineHeight: 0.95,
          letterSpacing: '-0.02em', marginBottom: '28px',
          textShadow: '0 4px 80px rgba(200,162,80,0.14)',
          maxWidth: '900px',
        }}>
          Your eBay Business,<br />
          <span style={{ background: 'linear-gradient(135deg,var(--gold) 20%,var(--gld2) 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Professionally Managed
          </span>
        </h1>

        <p style={{
          fontSize: '18px', color: 'var(--sil)', lineHeight: 1.7,
          maxWidth: '560px', marginBottom: '44px', fontWeight: 300,
        }}>
          Real-time order tracking, financial analytics, automation scripts, and AI assistance — everything a serious eBay seller needs in one dashboard.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" className="btn btn-solid" style={{ padding: '16px 40px', fontSize: '14px' }}>
            Start Free Trial
          </Link>
          <Link href="/login" className="btn btn-ghost" style={{ padding: '16px 40px', fontSize: '14px' }}>
            Sign In
          </Link>
        </div>

        {/* STATS ROW */}
        <div style={{
          display: 'flex', gap: '48px', marginTop: '72px',
          borderTop: '1px solid rgba(195,158,88,0.12)', paddingTop: '36px',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { num: 'Live', lbl: 'Order Tracking' },
            { num: 'Auto', lbl: 'Script Execution' },
            { num: 'AI', lbl: 'Profit Analysis' },
            { num: 'Multi', lbl: 'eBay Accounts' },
          ].map(s => (
            <div key={s.lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.03em' }}>{s.num}</div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--dim)', marginTop: '6px' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 52px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px', opacity: 0.8 }}>
            Everything You Need
          </div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px,4vw,52px)', fontWeight: 600, color: 'var(--txt)', lineHeight: 1.1 }}>
            Built for Serious Sellers
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '20px' }}>
          {[
            {
              icon: '📦',
              title: 'Live Order Management',
              desc: 'Real-time sync with your eBay orders. See open, awaiting shipment, and completed orders the moment they arrive.',
            },
            {
              icon: '📊',
              title: 'Financial Analytics',
              desc: 'Track gross revenue, net profit, ROI, and costs across every order. Know exactly what you\'re making.',
            },
            {
              icon: '⚡',
              title: 'Automation Scripts',
              desc: 'Run powerful automation scripts directly from the dashboard. Lead generation, ASIN lookup, and more.',
            },
            {
              icon: '🤖',
              title: 'AI Assistant',
              desc: 'Ask your AI assistant anything about your business, products, or strategy. Powered by GPT-4.',
            },
            {
              icon: '🔗',
              title: 'Simple eBay Connect',
              desc: 'Paste your eBay API credentials once and your entire account syncs instantly. No complex setup.',
            },
            {
              icon: '📈',
              title: 'Profit Tracking',
              desc: 'Know your exact take-home after eBay fees, shipping costs, and product costs on every item.',
            },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: '30px' }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>{f.icon}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--txt)', marginBottom: '10px', lineHeight: 1.2 }}>{f.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 52px', textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px', opacity: 0.8 }}>
          Get Started in Minutes
        </div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px,4vw,48px)', fontWeight: 600, color: 'var(--txt)', marginBottom: '52px', lineHeight: 1.1 }}>
          Three Steps to Launch
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '32px' }}>
          {[
            { n: '01', title: 'Create Account', desc: 'Sign up with your email and password in under 30 seconds.' },
            { n: '02', title: 'Connect eBay', desc: 'Paste your eBay App ID and OAuth token in the Settings tab.' },
            { n: '03', title: 'Launch Dashboard', desc: 'Your orders, financials, and analytics load instantly.' },
          ].map(s => (
            <div key={s.n} style={{ position: 'relative' }}>
              <div style={{
                fontFamily: 'Space Grotesk,sans-serif', fontSize: '48px', fontWeight: 800,
                color: 'rgba(200,162,80,0.15)', lineHeight: 1, marginBottom: '16px',
              }}>{s.n}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 600, color: 'var(--txt)', marginBottom: '10px' }}>{s.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.7, fontWeight: 300 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '80px 52px 120px', textAlign: 'center',
      }}>
        <div className="card" style={{
          maxWidth: '680px', margin: '0 auto', padding: '60px 52px',
        }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px,4vw,48px)', fontWeight: 600, color: 'var(--txt)', marginBottom: '16px', lineHeight: 1.1 }}>
            Ready to take control of your eBay business?
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--sil)', marginBottom: '36px', lineHeight: 1.7 }}>
            Join sellers who manage their operations professionally.
          </p>
          <Link href="/signup" className="btn btn-solid" style={{ padding: '16px 48px', fontSize: '14px' }}>
            Create Free Account
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: '1px solid var(--bdr)', padding: '28px 52px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '12px', color: 'var(--dim)',
      }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '16px', color: 'var(--sil)' }}>
          Ebay<span style={{ color: 'var(--gold)' }}>Dash</span>
        </div>
        <div>© 2025 EbayDash. All rights reserved.</div>
      </footer>
    </main>
  )
}
