import { queryRows, sql } from '@/lib/db'

export type SubscriptionPlan = 'trial' | 'pro' | string

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(['canceled', 'unpaid', 'incomplete', 'incomplete_expired'])

export function normalizeSubscriptionPlan(plan?: string | null, status?: string | null): SubscriptionPlan {
  const normalizedPlan = String(plan || 'trial').toLowerCase()
  const normalizedStatus = String(status || 'active').toLowerCase()

  if (normalizedPlan === 'pro' && !TERMINAL_SUBSCRIPTION_STATUSES.has(normalizedStatus)) {
    return 'pro'
  }

  return 'trial'
}

export async function ensureSubscriptionRow(userId: string | number) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return
  await sql`
    INSERT INTO user_subscriptions (user_id)
    VALUES (${uid})
    ON CONFLICT (user_id) DO NOTHING
  `.catch(() => {})
}

export async function getUserPlan(
  userId: string | number
): Promise<{ plan: SubscriptionPlan; status: string; stripeCustomerId: string | null } | null> {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return null
  const rows = await queryRows<{ plan: string; status: string; stripe_customer_id: string | null }>`
    SELECT plan, status, stripe_customer_id FROM user_subscriptions WHERE user_id = ${uid} LIMIT 1
  `.catch(() => [])
  if (!rows[0]) return null
  const rawPlan = rows[0].plan || 'trial'
  const status = rows[0].status || 'active'
  return {
    plan: normalizeSubscriptionPlan(rawPlan, status),
    status,
    stripeCustomerId: rows[0].stripe_customer_id || null,
  }
}

export async function getTrialUsage(userId: string | number) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return { listed: 0 }
  // Count only active listings as "trial usage"
  const rows = await queryRows<{ count: number }>`
    SELECT COUNT(*)::int AS count
    FROM listed_asins
    WHERE user_id = ${uid} AND ended_at IS NULL
  `.catch(() => [])
  return { listed: rows[0]?.count || 0 }
}

