import Link from 'next/link'

const sections = [
  {
    id: 'start',
    title: 'Start here',
    bullets: [
      'Sign in → open the dashboard.',
      'Connect eBay in Settings (one-time).',
      'Use Product Listing to publish — trial covers your first few listings.',
    ],
  },
  {
    id: 'trial',
    title: 'Free trial (5 listings)',
    bullets: [
      'You can publish up to 5 listings while on trial.',
      'Trial usage is tied to total listings published from the account, even if an item is ended later.',
      'After the limit, upgrade / contact your invite to keep publishing.',
    ],
  },
  {
    id: 'tabs',
    title: 'Tabs — what each one is for',
    bullets: [
      'Overview — pulse check: ship queue, quick stats.',
      'Orders — everything eBay synced in.',
      'Fulfillment — ship workflow + Amazon helper.',
      'Financials — profit view (fees included).',
      'Performance — what’s working in your catalog.',
      'Product Listing — pick a niche, find items, list.',
      'Continuous Listing — auto-built queue, same listing tools.',
      'Campaigns — promoted listings (desktop is easiest).',
      'ASIN Lookup — fix or confirm ASINs for orders.',
      'Scripts — power tools (desktop).',
      'Settings — eBay connect, auto listing, health.',
    ],
  },
  {
    id: 'list',
    title: 'List a product (short path)',
    bullets: [
      'Product Listing → choose a niche → Load / Find products.',
      'Click a card → check price + photos → List to eBay.',
      'If something is blocked, read the red message — it’s a safety check.',
    ],
  },
  {
    id: 'ship',
    title: 'Ship an order',
    bullets: [
      'Orders or Fulfillment → open the order.',
      'Use the flow to copy buyer address and buy on Amazon.',
      'Mark shipped on eBay when you’re done.',
    ],
  },
] as const

export default function GuidePage() {
  return (
    <main className="home-page guide-page">
      <nav className="home-nav">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div className="home-nav-links" aria-label="Guide sections">
          {sections.slice(0, 4).map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </div>
        <div className="home-nav-actions">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign In
          </Link>
          <Link href="/dashboard" className="btn btn-solid btn-sm">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="guide-hero">
        <div className="home-kicker">
          <span />
          Simple manual
        </div>
        <h1>How to use StackPilot</h1>
        <p className="guide-lead">Short sections. Skim the headings. You don’t have to read in order.</p>
        <div className="guide-hero-actions">
          <Link href="/dashboard" className="btn btn-solid">
            Open dashboard
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </section>

      <div className="guide-stack">
        {sections.map((sec) => (
          <section key={sec.id} id={sec.id} className="guide-card">
            <h2>{sec.title}</h2>
            <ul>
              {sec.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="guide-card guide-card--muted">
          <h2>Stuck?</h2>
          <ul>
            <li>
              Use <strong>Sync eBay</strong> in the top bar if numbers look old.
            </li>
            <li>
              Reconnect eBay in <strong>Settings</strong> if you see reconnect warnings.
            </li>
            <li>
              Mobile uses a lighter layout — heavy tools want a desktop browser.
            </li>
          </ul>
        </section>
      </div>

      <footer className="home-footer">
        <Link href="/" className="home-brand" aria-label="StackPilot home">
          Stack<span>Pilot</span>
        </Link>
        <div>
          <Link href="/dashboard">Dashboard</Link>
          <span aria-hidden> · </span>
          <Link href="/login">Sign in</Link>
        </div>
      </footer>
    </main>
  )
}
