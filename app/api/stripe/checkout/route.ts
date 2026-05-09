import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

  const priceId = process.env.STRIPE_PRICE_PRO!.trim()
  const origin = getAppOrigin(req)
  const userId = String(session.user.id)

  try {
    const stripe = getStripe()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?tab=settings&billing=success`,
      cancel_url: `${origin}/dashboard?tab=settings&billing=canceled`,
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
      ...(session.user.email ? { customer_email: session.user.email } : {}),
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ ok: false, error: { message: 'Stripe did not return a checkout URL.' } }, { status: 502 })
    }

    return NextResponse.json({ ok: true, url: checkoutSession.url })
  } catch (e) {
    console.error('[stripe/checkout]', e)
    return NextResponse.json(
      { ok: false, error: { message: e instanceof Error ? e.message : 'Checkout failed.' } },
      { status: 500 }
    )
  }
}
