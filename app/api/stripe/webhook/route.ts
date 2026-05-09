import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { queryRows } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { syncStripeSubscriptionToDb } from '@/lib/stripe-sync'

export const dynamic = 'force-dynamic'

async function resolveUserId(sub: Stripe.Subscription): Promise<number | null> {
  const fromMeta = Number(sub.metadata?.userId)
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!customerId) return null

  const rows = await queryRows<{ user_id: number }>`
    SELECT user_id FROM user_subscriptions WHERE stripe_customer_id = ${customerId} LIMIT 1
  `.catch(() => [])
  const uid = rows[0]?.user_id
  return Number.isFinite(uid) ? uid : null
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET missing')
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ ok: false, error: 'Missing signature' }, { status: 400 })

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (e) {
    console.error('[stripe/webhook] signature verify failed', e)
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const stripe = getStripe()
        const full = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['subscription', 'customer'],
        })

        const userId = Number(full.metadata?.userId ?? full.client_reference_id)
        if (!Number.isFinite(userId) || userId <= 0) {
          console.error('[stripe/webhook] checkout.session.completed missing user id', session.id)
          break
        }

        const sub = full.subscription as Stripe.Subscription | null
        const customerId =
          typeof full.customer === 'string' ? full.customer : full.customer && 'id' in full.customer ? full.customer.id : null

        if (!sub || !customerId) {
          console.error('[stripe/webhook] checkout missing subscription or customer', session.id)
          break
        }

        await syncStripeSubscriptionToDb({
          userId,
          customerId,
          subscription: sub,
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await resolveUserId(sub)
        if (!userId) {
          console.error('[stripe/webhook] cannot resolve user for subscription', sub.id)
          break
        }

        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        if (!customerId) break

        await syncStripeSubscriptionToDb({
          userId,
          customerId,
          subscription: sub,
        })
        break
      }

      default:
        break
    }
  } catch (e) {
    console.error('[stripe/webhook] handler error', event.type, e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
