'use client'

/**
 * Free-trial progress: only trial accounts see this. Pro accounts never see trial messaging.
 */
export function TrialMeter({
  loading,
  plan,
  listed,
  trialLimit,
  variant = 'full',
}: {
  loading: boolean
  plan: string
  listed: number
  trialLimit: number
  variant?: 'full' | 'compact' | 'topbar'
}) {
  const limit = Math.max(1, trialLimit)
  const used = Math.max(0, listed)
  if (loading || plan !== 'trial') return null

  const pct = Math.min(100, (used / limit) * 100)
  const remaining = Math.max(0, limit - used)
  const complete = remaining === 0

  const pad =
    variant === 'topbar'
      ? '6px var(--xpad)'
      : variant === 'compact'
        ? '10px 14px'
        : '12px 16px'

  return (
    <div
      role="status"
      aria-label={`Free trial: ${Math.min(used, limit)} of ${limit} listings used, ${remaining} remaining`}
      style={{
        padding: pad,
        borderRadius: variant === 'topbar' ? 0 : 12,
        background: 'rgba(56,189,248,0.08)',
        border: '1px solid rgba(125,211,252,0.18)',
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
          marginBottom: variant === 'topbar' ? 6 : 8,
        }}
      >
        <div style={{ fontSize: variant === 'topbar' ? 10 : 12, fontWeight: 700, color: 'var(--plat)' }}>
          Free trial
        </div>
        <div style={{ fontSize: variant === 'topbar' ? 10 : 11, color: 'var(--sil)', fontWeight: 600 }}>
          {remaining} left - {Math.min(used, limit)} / {limit} used
        </div>
      </div>
      <div
        style={{
          height: variant === 'topbar' ? 3 : 5,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold),var(--gld2))', transition: 'width 0.25s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5, marginTop: variant === 'topbar' ? 6 : 8 }}>
        {complete
          ? 'Free trial complete for this account. Upgrade to keep listing.'
          : 'Counts total listings published from this account during the free trial.'}
      </div>
    </div>
  )
}
