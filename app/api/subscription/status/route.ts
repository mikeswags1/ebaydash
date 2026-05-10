import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isStripeBillingConfigured } from '@/lib/stripe'
import { ensureSubscriptionRow, getTrialUsage, getUserPlan } from '@/lib/subscription'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  await ensureSubscriptionRow(session.user.id)
  const sub = await getUserPlan(session.user.id)
  const plan = sub?.plan || 'trial'
  const status = sub?.status || 'active'
  const parsedTrialLimit = Number(process.env.TRIAL_LIST_LIMIT || '5')
  const trialLimit = Number.isFinite(parsedTrialLimit) && parsedTrialLimit > 0 ? Math.floor(parsedTrialLimit) : 5
  const usage = plan === 'trial' ? await getTrialUsage(session.user.id) : { listed: 0 }
  const remaining = Math.max(0, trialLimit - usage.listed)

  const stripeReady = isStripeBillingConfigured()
  const stripeCustomerId = sub?.stripeCustomerId || null

  return NextResponse.json({
    ok: true,
    plan,
    status,
    trialLimit,
    listed: usage.listed,
    trialRemaining: plan === 'trial' ? remaining : 0,
    isPro: plan === 'pro',
    billing: {
      checkoutAvailable: stripeReady,
      portalAvailable: stripeReady && Boolean(stripeCustomerId),
    },
  })
}

