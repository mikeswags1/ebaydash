import Link from 'next/link'

const queueItems = [
  {
    title: 'Wireless charging stand',
    cost: '$24.00',
    price: '$49.99',
    margin: '$18.42',
    status: 'Ready',
  },
  {
    title: 'Drawer organizer set',
    cost: '$18.00',
    price: '$39.99',
    margin: '$15.86',
    status: 'Checked',
  },
  {
    title: 'Compact desk lamp',
    cost: '$31.00',
    price: '$67.99',
    margin: '$27.15',
    status: 'Ready',
  },
]

const metrics = [
  { label: 'Catalog signals', value: '13.9K+', note: 'scored items' },
  { label: 'Queue target', value: '30', note: 'ready listings' },
  { label: 'Checks', value: '8', note: 'quality gates' },
  { label: 'Refresh', value: 'Live', note: 'seller-specific' },
]

const pillars = [
  {
    title: 'Catalog Research',
    desc: 'Builds a fresh queue of listing candidates using market signals, margin math, demand indicators, image readiness, and seller fit.',
  },
  {
    title: 'Listing Guardrails',
    desc: 'Flags weak titles, bad pricing, duplicates, restricted categories, thin image sets, and other risky listings before publishing.',
  },
  {
    title: 'Performance Intelligence',
    desc: 'Shows which categories, niches, products, and margins are working so sellers can make better listing decisions over time.',
  },
]

const workflow = [
  'Connect eBay and choose a niche',
  'Review 30 fresh product candidates',
  'Publish with pricing and policy checks',
  'Track orders, refunds, financials, and performance',
]

export default function Landing() {
  return (
    <main className="home-page">
      <nav className="home-nav">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div className="home-nav-links" aria-label="Product sections">
          <a href="#research">Research</a>
          <a href="#workflow">Workflow</a>
          <a href="#safety">Safety</a>
        </div>
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
            Live eBay seller command center
          </div>
          <h1>StackPilot</h1>
          <p>
            A cleaner operating system for eBay sellers: organize listing work,
            review catalog opportunities, monitor performance, and keep daily operations moving.
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

        <div className="home-command-preview" aria-label="StackPilot dashboard preview">
          <div className="home-preview-bar">
          <div>
            <span>Continuous Listing</span>
            <strong>Fresh listing candidates, ready to review</strong>
          </div>
            <em>Synced now</em>
          </div>

          <div className="home-metric-grid">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </div>
            ))}
          </div>

          <div className="home-queue">
            {queueItems.map((item) => (
              <article key={item.title} className="home-queue-row">
                <div className="home-product-thumb" />
                <div>
                  <strong>{item.title}</strong>
                  <span>Cost basis {item.cost} · Target price {item.price}</span>
                </div>
                <div>
                  <strong>{item.margin}</strong>
                  <span>{item.status}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="research" className="home-section">
        <div className="home-section-heading">
          <span>What customers get</span>
          <h2>One dashboard for finding, listing, and running the business.</h2>
          <p>
            StackPilot is built for sellers who need speed without chaos. It keeps
            listing opportunities fresh, makes decisions clearer, and protects the
            account from sloppy automation.
          </p>
        </div>

        <div className="home-pillars">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="home-pillar">
              <h3>{pillar.title}</h3>
              <p>{pillar.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="home-section home-flow-section">
        <div className="home-section-heading">
          <span>Daily workflow</span>
          <h2>Designed around how sellers actually list.</h2>
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

      <section id="safety" className="home-cta">
        <div>
          <span>Private beta</span>
          <h2>Built for sellers who want faster listing with better control.</h2>
          <p>
            Existing users can sign in now. New sellers can request access as the
            platform moves toward public launch.
          </p>
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
        <div>&copy; 2026 StackPilot. Catalog research, listing safety, and seller operations.</div>
      </footer>
    </main>
  )
}
