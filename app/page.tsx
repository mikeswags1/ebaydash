import Link from 'next/link'

const featureCards = [
  {
    label: 'Product Finder',
    title: 'Find products worth listing',
    desc: 'Build 30-item queues from a scored Amazon source pool using profit, ROI, demand signals, image readiness, and seller performance.',
  },
  {
    label: 'Listing Guard',
    title: 'Skip risky listings before they post',
    desc: 'Weak titles, one-image products, bad prices, duplicate ASINs, restricted items, and low-profit products are blocked or replaced.',
  },
  {
    label: 'Continuous Mode',
    title: 'Keep fresh items ready',
    desc: 'A randomized queue keeps sellers moving, replaces listed products, and helps different users see different product mixes.',
  },
  {
    label: 'Orders',
    title: 'Track what needs action',
    desc: 'See live orders, shipment status, refunds, and fulfillment context from one organized operations screen.',
  },
  {
    label: 'Financials',
    title: 'Know the real money',
    desc: 'Review revenue, fees, product cost, refunds, ROI, and profit across flexible date ranges.',
  },
  {
    label: 'Performance',
    title: 'Learn what to list next',
    desc: 'Use sales, profit, views, watchers, and category trends to spot winning niches and avoid weak ones.',
  },
]

const flow = [
  'Connect eBay',
  'Choose a niche or continuous queue',
  'Review price, profit, images, and policy checks',
  'Publish listings and track performance',
]

const previewRows = [
  { name: 'Phone accessories', profit: '$24.29', roi: '97%', tone: 'green' },
  { name: 'Home organization', profit: '$18.40', roi: '62%', tone: 'blue' },
  { name: 'Low image item', profit: 'Skipped', roi: 'Needs review', tone: 'amber' },
]

export default function Landing() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div className="landing-nav-actions">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign In
          </Link>
          <Link href="/signup" className="btn btn-solid btn-sm">
            Request Access
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-plane-wrap" aria-hidden="true">
          <img className="landing-plane" src="/stackpilot-plane.svg" alt="" />
          <span className="landing-plane-trail" />
        </div>
        <div className="landing-hero-inner">
          <div className="landing-kicker">
            <span />
            eBay listing command center
          </div>
          <h1>Find better products. List with guardrails. Run eBay calmly.</h1>
          <p>
            StackPilot helps sellers source profitable Amazon products, review listing safety,
            publish to eBay, and track orders, refunds, and profit from one clean dashboard.
          </p>
          <div className="landing-actions">
            <Link href="/signup" className="btn btn-solid">
              Request Access
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Sign In
            </Link>
          </div>

          <div className="landing-preview" aria-label="StackPilot product listing preview">
            <div className="landing-preview-header">
              <div>
                <span className="landing-preview-label">Live workflow</span>
                <strong>30-product listing queue</strong>
              </div>
              <span className="landing-preview-pill">Auto-refill on</span>
            </div>
            <div className="landing-preview-grid">
              <div className="landing-preview-main">
                <div className="landing-card-title">Ready to list</div>
                <div className="landing-big-number">30</div>
                <div className="landing-muted">Products ranked by profit, ROI, demand, and safety.</div>
              </div>
              <div className="landing-preview-main">
                <div className="landing-card-title">Source pool</div>
                <div className="landing-big-number">13.9K</div>
                <div className="landing-muted">Fresh Amazon candidates scored in the background.</div>
              </div>
              <div className="landing-preview-main">
                <div className="landing-card-title">Quality checks</div>
                <div className="landing-check-list">
                  <span>2+ images</span>
                  <span>Profit floor</span>
                  <span>Policy guard</span>
                </div>
              </div>
            </div>
            <div className="landing-preview-table">
              {previewRows.map((row) => (
                <div className="landing-preview-row" key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.profit}</strong>
                  <em data-tone={row.tone}>{row.roi}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-plain">
        <div className="landing-section-copy">
          <span className="landing-section-label">What customers get</span>
          <h2>A dashboard that explains what to list, what to skip, and what needs attention.</h2>
          <p>
            StackPilot is built for sellers who want sourcing, listing, orders, financials,
            and performance learning in one place without guessing from scattered tabs.
          </p>
        </div>
        <div className="landing-feature-grid">
          {featureCards.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <span>{feature.label}</span>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-flow">
        <div className="landing-section-copy">
          <span className="landing-section-label">How it works</span>
          <h2>From product idea to live listing in a simple review flow.</h2>
        </div>
        <div className="landing-flow-grid">
          {flow.map((step, index) => (
            <div className="landing-flow-step" key={step}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-section-label">Private beta</span>
          <h2>Built for sellers who want cleaner operations and smarter listing decisions.</h2>
          <p>Sign in if you already have access, or request access when the next beta seats open.</p>
        </div>
        <div className="landing-actions">
          <Link href="/signup" className="btn btn-solid">
            Request Access
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Existing Seller Sign In
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div>&copy; 2026 StackPilot. Seller operations, product sourcing, and listing intelligence.</div>
      </footer>
    </main>
  )
}
