import { NAV_ITEMS } from '../constants'
import type { Tab } from '../types'

export function DashboardSidebar({
  tab,
  onTabChange,
  connected,
  niche,
  awaitingCount,
  userLabel,
  onSignOut,
}: {
  tab: Tab
  onTabChange: (tab: Tab) => void
  connected: boolean
  niche: string | null
  awaitingCount: number
  userLabel?: string | null
  onSignOut: () => void
}) {
  return (
    <aside
      className="dashboard-sidebar"
      style={{
        width: '260px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        background: 'linear-gradient(170deg,#0c2d4a 0%,#083249 45%,#062840 100%)',
        borderRight: '1px solid rgba(56,189,248,0.18)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '6px 0 40px rgba(14,165,233,0.15)',
      }}
    >
      <div className="dashboard-brand" style={{ padding: '32px 24px 28px', borderBottom: '1px solid rgba(56,189,248,0.12)' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 700, color: '#e0f2fe', lineHeight: 1 }}>
          Stack
          <span
            style={{
              background: 'linear-gradient(135deg,var(--gold),var(--gld2))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Pilot
          </span>
        </div>
        <div
          style={{
            fontSize: '8px',
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(148,212,255,0.6)',
            marginTop: '6px',
            opacity: 0.85,
          }}
        >
          Operations Dashboard
        </div>
      </div>

      <div className="dashboard-status" style={{ padding: '14px 20px', borderBottom: '1px solid rgba(56,189,248,0.10)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 14px',
            borderRadius: '10px',
            background: connected ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.28)' : 'rgba(255,255,255,0.10)'}`,
          }}
        >
          <div
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              flexShrink: 0,
              background: connected ? '#34d399' : 'rgba(148,212,255,0.4)',
              boxShadow: connected ? '0 0 8px #34d399' : 'none',
              animation: connected ? 'glow-pulse 2.4s ease infinite' : 'none',
            }}
          />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: connected ? '#34d399' : 'rgba(148,212,255,0.5)',
            }}
          >
            {connected ? 'eBay Connected' : 'eBay Not Connected'}
          </span>
        </div>
      </div>

      {niche ? (
        <div className="dashboard-niche" style={{ padding: '10px 20px', borderBottom: '1px solid rgba(56,189,248,0.10)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.18)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#7dd3fc' }}>NK</span>
            <div>
              <div
                style={{
                  fontSize: '7px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  color: 'rgba(148,212,255,0.5)',
                  marginBottom: '2px',
                }}
              >
                Niche
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#7dd3fc' }}>{niche}</div>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="dashboard-nav" style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              border: tab === item.id ? '1px solid rgba(56,189,248,0.35)' : '1px solid transparent',
              background: tab === item.id ? 'linear-gradient(135deg,rgba(56,189,248,0.18),rgba(14,165,233,0.08))' : 'none',
              color: tab === item.id ? '#7dd3fc' : 'rgba(148,212,255,0.55)',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'inherit',
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            {tab === item.id ? (
              <div
                className="dashboard-nav-active-bar"
                style={{
                  position: 'absolute',
                  left: '-1px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px',
                  height: '55%',
                  background: 'linear-gradient(180deg,#38bdf8,#0ea5e9)',
                  borderRadius: '0 3px 3px 0',
                  boxShadow: '0 0 10px rgba(56,189,248,0.6)',
                }}
              />
            ) : null}
            <span
              style={{
                display: 'inline-flex',
                width: '24px',
                height: '24px',
                borderRadius: '8px',
                alignItems: 'center',
                justifyContent: 'center',
                background: tab === item.id ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.05)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              {item.label.match(/^\p{Emoji}/u)?.[0] ?? item.label.slice(0, 2).toUpperCase()}
            </span>
            {item.label.replace(/^\p{Emoji}\s*/u, '')}
            {item.badge === 'orders' && awaitingCount > 0 ? (
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '8px',
                  fontWeight: 700,
                  background: 'rgba(232,63,80,0.12)',
                  color: 'var(--red)',
                  border: '1px solid rgba(232,63,80,0.25)',
                }}
              >
                {awaitingCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="dashboard-user" style={{ padding: '16px 20px', borderTop: '1px solid rgba(56,189,248,0.12)' }}>
        <div style={{ fontSize: '11px', color: 'rgba(148,212,255,0.65)', marginBottom: '10px', fontWeight: 500 }}>{userLabel}</div>
        <button onClick={onSignOut} className="btn btn-ghost btn-sm btn-full" style={{ fontSize: '11px', color: 'rgba(148,212,255,0.6)', borderColor: 'rgba(56,189,248,0.18)' }}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
