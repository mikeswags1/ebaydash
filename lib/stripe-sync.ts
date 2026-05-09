import type Stripe from 'stripe'
import { sql } from '@/lib/db'
import { ensureSubscriptionRow } from '@/lib/subscription'

function mapSubscription(sub: Stripe.Subscription): { plan: string; status: string } {
  switch (sub.status) {
    case 'active':
    case 'trialing':
      return { plan: 'pro', status: 'active' }
    case 'past_due':
      return { plan: 'pro', status: 'past_due' }
    case 'paused':
      return { plan: 'pro', status: 'paused' }
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return { plan: 'trial', status: sub.status }
    case 'incomplete':
      return { plan: 'trial', status: 'incomplete' }
    default:
      return { plan: 'trial', status: sub.status }
  }
}

function primaryPrice(sub: Stripe.Subscription): Stripe.Price | null {
  const item = sub.items?.data?.[0]
  return item?.price ?? null
}

/**
 * Upsert subscription row from a Stripe Subscription object (used by webhooks + checkout completion).
 */
export async function syncStripeSubscriptionToDb(params: {
  userId: number
  customerId: string
  subscription: Stripe.Subscription
}) {
  const { plan, status } = mapSubscription(params.subscription)
  const price = primaryPrice(params.subscription)
  const amount = price?.unit_amount ?? null
  const interval = price?.recurring?.interval ?? null
  const cur = params.subscription.currency?.toUpperCase() || 'USD'

  const ps = params.subscription.current_period_start
    ? new Date(params.subscription.current_period_start * 1000).toISOString()
    : null
  const pe = params.subscription.current_period_end
    ? new Date(params.subscription.current_period_end * 1000).toISOString()
    : null

  await ensureSubscriptionRow(params.userId)

  await sql`
    UPDATE user_subscriptions SET
      plan = ${plan},
      status = ${status},
      stripe_customer_id = ${params.customerId},
      external_subscription_id = ${params.subscription.id},
      billing_interval = ${interval},
      amount_cents = ${amount},
      currency = ${cur},
      current_period_start = ${ps},
      current_period_end = ${pe},
      payment_method = ${'stripe'},
      updated_at = NOW()
    WHERE user_id = ${params.userId}
  `
}
