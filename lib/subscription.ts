import { queryRows, sql } from '@/lib/db'

export type SubscriptionPlan = 'trial' | 'pro' | string

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(['canceled', 'unpaid', 'incomplete', 'incomplete_expired'])
let subscriptionSchemaReady = false

async function ensureSubscriptionSchema() {
  if (subscriptionSchemaReady) return
  try {
    await sql`ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS trial_listings_used INTEGER NOT NULL DEFAULT 0`
    subscriptionSchemaReady = true
  } catch {
    // Older/uninitialized databases are handled by /api/setup-db; callers also fail closed when needed.
  }
}

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
  await ensureSubscriptionSchema()
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
  await ensureSubscriptionSchema()
  // Trial usage is lifetime account usage, not active inventory slots.
  // Use the larger of the durable counter and historical listings so older
  // accounts cannot regain free listings by ending items.
  const rows = await queryRows<{ stored: number; historical: number }>`
    WITH history AS (
      SELECT COUNT(*)::int AS historical
      FROM listed_asins
      WHERE user_id = ${uid}
    )
    SELECT
      COALESCE(us.trial_listings_used, 0)::int AS stored,
      COALESCE(history.historical, 0)::int AS historical
    FROM (SELECT ${uid}::int AS user_id) current_user
    LEFT JOIN user_subscriptions us ON us.user_id = current_user.user_id
    CROSS JOIN history
  `.catch(() => [])
  const row = rows[0]
  return { listed: Math.max(row?.stored || 0, row?.historical || 0) }
}

async function syncTrialUsageFloor(userId: number, minimum: number) {
  if (!Number.isFinite(userId) || !Number.isFinite(minimum) || minimum <= 0) return
  await ensureSubscriptionSchema()
  await sql`
    UPDATE user_subscriptions
    SET trial_listings_used = GREATEST(trial_listings_used, ${Math.floor(minimum)}),
        updated_at = NOW()
    WHERE user_id = ${userId}
  `.catch(() => {})
}

export async function reserveTrialListingSlot(userId: string | number, trialLimit: number) {
  const uid = Number(userId)
  const limit = Math.floor(Number(trialLimit))
  if (!Number.isFinite(uid) || !Number.isFinite(limit) || limit <= 0) return { ok: false, listed: 0 }

  await ensureSubscriptionRow(uid)
  const usage = await getTrialUsage(uid)
  await syncTrialUsageFloor(uid, usage.listed)

  if (usage.listed >= limit) {
    return { ok: false, listed: usage.listed }
  }

  const rows = await queryRows<{ trial_listings_used: number }>`
    UPDATE user_subscriptions
    SET trial_listings_used = trial_listings_used + 1,
        updated_at = NOW()
    WHERE user_id = ${uid}
      AND trial_listings_used < ${limit}
    RETURNING trial_listings_used
  `.catch(() => [])

  if (rows[0]) return { ok: true, listed: rows[0].trial_listings_used }

  const latest = await getTrialUsage(uid)
  return { ok: false, listed: latest.listed }
}

export async function releaseTrialListingSlot(userId: string | number) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return
  await ensureSubscriptionSchema()
  await sql`
    UPDATE user_subscriptions
    SET trial_listings_used = GREATEST(trial_listings_used - 1, 0),
        updated_at = NOW()
    WHERE user_id = ${uid}
  `.catch(() => {})
}

