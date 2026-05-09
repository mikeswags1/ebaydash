'use client'

export function TrialMeter({
  loading,
  plan,
  listed,
  trialLimit,
  variant = 'full',
  onOpenSettings,
}: {
  loading: boolean
  plan: string
  listed: number
  trialLimit: number
  variant?: 'full' | 'compact' | 'topbar'
  onOpenSettings?: () => void
}) {
  if (loading || plan !== 'trial') return null

  const limit = Math.max(1, trialLimit)
  const used = Math.max(0, listed)
  const pct = Math.min(100, (used / limit) * 100)
  const atLimit = used >= limit
  const remaining = Math.max(0, limit - used)

  const pad =
    variant === 'topbar'
      ? '6px var(--xpad)'
      : variant === 'compact'
        ? '10px 14px'
        : '12px 16px'

  return (
    <div
      role="status"
      aria-label={`Free trial: ${used} of ${limit} listings used`}
      style={{
        padding: pad,
        borderRadius: variant === 'topbar' ? 0 : 12,
        background: atLimit ? 'rgba(232,63,80,0.09)' : 'rgba(56,189,248,0.08)',
        border: `1px solid ${atLimit ? 'rgba(232,63,80,0.22)' : 'rgba(125,211,252,0.18)'}`,
        marginBottom: variant === 'topbar' ? 0 : undefined,
        borderTop: variant === 'topbar' ? '1px solid rgba(125,211,252,0.12)' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: variant === 'topbar' ? 4 : 8,
        }}
      >
        <div style={{ fontSize: variant === 'topbar' ? 10 : 12, fontWeight: 700, color: atLimit ? 'var(--red)' : 'var(--plat)' }}>
          {atLimit ? 'Trial limit reached' : 'Free trial'}
        </div>
        <div style={{ fontSize: variant === 'topbar' ? 10 : 11, color: 'var(--sil)', fontWeight: 600 }}>
          {atLimit ? `${used} / ${limit} used` : `${remaining} left · ${used} / ${limit} used`}
        </div>
      </div>
      <div
        style={{
          height: variant === 'topbar' ? 3 : 5,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          marginBottom: atLimit && onOpenSettings ? 10 : 0,
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: atLimit ? 'var(--red)' : 'linear-gradient(90deg,var(--gold),var(--gld2))', transition: 'width 0.25s ease' }} />
      </div>
      {variant === 'topbar' ? (
        atLimit ? (
          <div style={{ fontSize: 10, color: 'var(--sil)', lineHeight: 1.45, marginTop: 4 }}>
            Publishing paused — upgrade or contact your invite. Settings has account tools.
          </div>
        ) : null
      ) : atLimit ? (
        <div style={{ fontSize: 11, color: 'var(--sil)', lineHeight: 1.5 }}>
          Publishing is paused until your plan is upgraded. Open Settings for account tools, or contact whoever invited you to StackPilot.
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5, marginTop: 6 }}>
          Counts active listings you published with StackPilot. If you end a listing on eBay, a slot can open again.
        </div>
      )}
      {atLimit && onOpenSettings ? (
        <button type="button" className="btn btn-gold btn-sm" style={{ marginTop: 8, fontSize: 11 }} onClick={onOpenSettings}>
          Open Settings
        </button>
      ) : null}
    </div>
  )
}
