import Link from 'next/link'

const features = [
  {
    icon: 'Orders',
    title: 'Live Order Management',
    desc: 'See open, awaiting shipment, and completed eBay orders in one place with fast operational context.',
  },
  {
    icon: 'P&L',
    title: 'Financial Analytics',
    desc: 'Track revenue, profit, ROI, and costs with a dashboard built for day-to-day seller decisions.',
  },
  {
    icon: 'Auto',
    title: 'Automation Tools',
    desc: 'Run sourcing and listing workflows from the dashboard without jumping between scattered scripts.',
  },
  {
    icon: 'AI',
    title: 'AI Assistance',
    desc: 'Use built-in AI support for research, product analysis, and decision-making inside your workflow.',
  },
  {
    icon: 'Sync',
    title: 'Guided Account Connect',
    desc: 'Connect eBay and Amazon cleanly so your orders, catalog data, and listing actions stay aligned.',
  },
  {
    icon: 'ROI',
    title: 'Profit Visibility',
    desc: 'Know what each item is actually earning after fees, shipping, and sourcing cost.',
  },
]

const steps = [
  { n: '01', title: 'Create Account', desc: 'Sign up in under a minute and get access to the full dashboard shell.' },
  { n: '02', title: 'Connect Your Stores', desc: 'Authorize eBay and Amazon so orders, catalog data, and actions can sync correctly.' },
  { n: '03', title: 'Run Operations', desc: 'Manage orders, source products, and publish listings from a single workspace.' },
]

export default function Landing() {
  return (
    <main style={{ position: 'relative', zIndex: 1 }}>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 52px',
          background: 'rgba(8,6,3,0.92)',
          backdropFilter: 'blur(60px)',
          borderBottom: '1px solid rgba(195,158,88,0.12)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--txt)',
            letterSpacing: '0.01em',
          }}
        >
          Ebay
          <span
            style={{
              background: 'linear-gradient(135deg,var(--gold),var(--gld2))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Dash
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign In
          </Link>
          <Link href="/signup" className="btn btn-solid btn-sm">
            Get Started
          </Link>
        </div>
      </nav>

      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 52px 80px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 18px',
            borderRadius: '100px',
            marginBottom: '32px',
            background: 'rgba(200,162,80,0.08)',
            border: '1px solid rgba(200,162,80,0.22)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'var(--grn)',
              boxShadow: '0 0 8px var(--grn)',
              display: 'inline-block',
            }}
          />
          Live eBay Operations Platform
        </div>

        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(52px,7vw,88px)',
            fontWeight: 600,
            color: 'var(--txt)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            marginBottom: '28px',
            textShadow: '0 4px 80px rgba(200,162,80,0.14)',
            maxWidth: '900px',
          }}
        >
          Your eBay Business,
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg,var(--gold) 20%,var(--gld2) 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Professionally Managed
          </span>
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: 'var(--sil)',
            lineHeight: 1.7,
            maxWidth: '620px',
            marginBottom: '44px',
            fontWeight: 300,
          }}
        >
          Real-time order tracking, listing workflows, sourcing tools, and operational automation for serious eBay sellers who need one organized control center.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" className="btn btn-solid" style={{ padding: '16px 40px', fontSize: '14px' }}>
            Start Free Trial
          </Link>
          <Link href="/login" className="btn btn-ghost" style={{ padding: '16px 40px', fontSize: '14px' }}>
            Sign In
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '48px',
            marginTop: '72px',
            borderTop: '1px solid rgba(195,158,88,0.12)',
            paddingTop: '36px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {[
            { num: 'Live', lbl: 'Order Tracking' },
            { num: 'Auto', lbl: 'Workflow Tools' },
            { num: 'AI', lbl: 'Decision Support' },
            { num: 'Multi', lbl: 'Channel Sync' },
          ].map((stat) => (
            <div key={stat.lbl} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'Space Grotesk,sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: 'var(--gold)',
                  letterSpacing: '-0.03em',
                }}
              >
                {stat.num}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: 'var(--dim)',
                  marginTop: '6px',
                }}
              >
                {stat.lbl}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 52px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: '16px',
              opacity: 0.8,
            }}
          >
            Everything You Need
          </div>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(36px,4vw,52px)',
              fontWeight: 600,
              color: 'var(--txt)',
              lineHeight: 1.1,
            }}
          >
            Built for Serious Sellers
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '20px' }}>
          {features.map((feature) => (
            <div key={feature.title} className="card" style={{ padding: '30px' }}>
              <div style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--gold)', fontWeight: 700 }}>
                {feature.icon}
              </div>
              <div
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--txt)',
                  marginBottom: '10px',
                  lineHeight: 1.2,
                }}
              >
                {feature.title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.7, fontWeight: 300 }}>
                {feature.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 52px', textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: '16px',
            opacity: 0.8,
          }}
        >
          Get Started in Minutes
        </div>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(32px,4vw,48px)',
            fontWeight: 600,
            color: 'var(--txt)',
            marginBottom: '52px',
            lineHeight: 1.1,
          }}
        >
          Three Steps to Launch
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '32px' }}>
          {steps.map((step) => (
            <div key={step.n} style={{ position: 'relative' }}>
              <div
                style={{
                  fontFamily: 'Space Grotesk,sans-serif',
                  fontSize: '48px',
                  fontWeight: 800,
                  color: 'rgba(200,162,80,0.15)',
                  lineHeight: 1,
                  marginBottom: '16px',
                }}
              >
                {step.n}
              </div>
              <div
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: 'var(--txt)',
                  marginBottom: '10px',
                }}
              >
                {step.title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--sil)', lineHeight: 1.7, fontWeight: 300 }}>
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 52px 120px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '680px', margin: '0 auto', padding: '60px 52px' }}>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(32px,4vw,48px)',
              fontWeight: 600,
              color: 'var(--txt)',
              marginBottom: '16px',
              lineHeight: 1.1,
            }}
          >
            Ready to take control of your eBay business?
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--sil)', marginBottom: '36px', lineHeight: 1.7 }}>
            Join sellers who want a cleaner, faster way to run operations.
          </p>
          <Link href="/signup" className="btn btn-solid" style={{ padding: '16px 48px', fontSize: '14px' }}>
            Create Free Account
          </Link>
        </div>
      </section>

      <footer
        style={{
          borderTop: '1px solid var(--bdr)',
          padding: '28px 52px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--dim)',
        }}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: '16px', color: 'var(--sil)' }}>
          Ebay<span style={{ color: 'var(--gold)' }}>Dash</span>
        </div>
        <div>&copy; 2026 StackPilot. All rights reserved.</div>
      </footer>
    </main>
  )
}
