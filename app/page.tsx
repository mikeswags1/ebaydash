import Link from 'next/link'

const pillars = [
  {
    label: 'Source',
    title: 'Find products worth listing',
    desc: 'StackPilot keeps a scored product pool ready, then ranks items by profit, ROI, demand signals, image readiness, and seller fit.',
  },
  {
    label: 'Protect',
    title: 'Review before anything goes live',
    desc: 'Weak titles, bad pricing, duplicate ASINs, restricted products, low-profit items, and thin image sets are blocked or replaced.',
  },
  {
    label: 'Operate',
    title: 'Run the whole seller workflow',
    desc: 'Track orders, refunds, profit, active listings, category performance, and what to list next from one clean dashboard.',
  },
]

const workflow = [
  'Connect eBay',
  'Load 30 product candidates',
  'Review price, profit, images, and policy checks',
  'Publish and let the queue refill',
]

const checks = [
  { label: 'Product source', value: 'Fresh pool' },
  { label: 'Listing safety', value: 'Preflight checks' },
  { label: 'Pricing', value: 'Dynamic ROI' },
  { label: 'Performance', value: 'Learns by seller' },
]

export default function Landing() {
  return (
    <main className="home-page">
      <nav className="home-nav">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div className="home-nav-actions">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign In
          </Link>
          <Link href="/signup" className="btn btn-solid btn-sm">
            Request Access
          </Link>
        </div>
      </nav>

      <section className="home-hero">
        <div className="home-plane-wrap" aria-hidden="true">
          <span className="home-flight-path" />
          <img className="home-plane" src="/stackpilot-plane.svg" alt="" />
        </div>

        <div className="home-hero-copy">
          <div className="home-kicker">
            <span />
            eBay seller operations
          </div>
          <h1>Source, list, and manage eBay with more control.</h1>
          <p>
            StackPilot helps sellers find profitable Amazon products, avoid bad listings,
            publish faster, and understand what is actually making money.
          </p>
          <div className="home-actions">
            <Link href="/signup" className="btn btn-solid">
              Request Access
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Sign In
            </Link>
          </div>
        </div>

        <div className="home-status-panel" aria-label="StackPilot workflow summary">
          <div className="home-status-header">
            <div>
              <span>Product queue</span>
              <strong>30 ready items</strong>
            </div>
            <em>Auto-refill</em>
          </div>
          <div className="home-status-grid">
            {checks.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <span>What it does</span>
          <h2>A cleaner command center for listing decisions.</h2>
          <p>
            The dashboard is built around the real daily workflow: find good products,
            list safely, watch the money, and double down on what performs.
          </p>
        </div>

        <div className="home-pillars">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="home-pillar">
              <span>{pillar.label}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-flow-section">
        <div className="home-section-heading">
          <span>How listing works</span>
          <h2>Simple enough to move fast, strict enough to avoid bad posts.</h2>
        </div>
        <div className="home-flow">
          {workflow.map((step, index) => (
            <div key={step} className="home-flow-step">
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <span>Private beta</span>
          <h2>Built for sellers who want smarter sourcing and cleaner operations.</h2>
          <p>Existing users can sign in now. New access opens as the beta expands.</p>
        </div>
        <div className="home-actions">
          <Link href="/signup" className="btn btn-solid">
            Request Access
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign In
          </Link>
        </div>
      </section>

      <footer className="home-footer">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div>&copy; 2026 StackPilot. Product sourcing, listing safety, and seller operations.</div>
      </footer>
    </main>
  )
}
