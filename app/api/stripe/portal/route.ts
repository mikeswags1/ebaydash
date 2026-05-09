import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryRows } from '@/lib/db'
import { getAppOrigin } from '@/lib/app-url'
import { getStripe, isStripeBillingConfigured } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ ok: false, error: { message: 'Billing is not configured.' } }, { status: 503 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const uid = Number(session.user.id)
  const rows = await queryRows<{ stripe_customer_id: string | null }>`
    SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = ${uid} LIMIT 1
  `.catch(() => [])

  const customerId = rows[0]?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ ok: false, error: { message: 'No Stripe customer on file. Subscribe first.' } }, { status: 400 })
  }

  const origin = getAppOrigin(req)

  try {
    const stripe = getStripe()
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard?tab=settings`,
    })

    return NextResponse.json({ ok: true, url: portal.url })
  } catch (e) {
    console.error('[stripe/portal]', e)
    return NextResponse.json(
      { ok: false, error: { message: e instanceof Error ? e.message : 'Portal failed.' } },
      { status: 500 }
    )
  }
}
