import crypto from 'crypto'
import { queryRows, sql } from '@/lib/db'

export type FulfillmentState = 'NOT_STARTED' | 'PREFILLED' | 'PURCHASED' | 'ISSUE'

export type FulfillmentShipTo = {
  fullName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  stateOrProvince?: string
  postalCode?: string
  countryCode?: string
  phoneNumber?: string
}

export type FulfillmentJobRow = {
  id: string | number
  user_id: string
  order_id: string
  legacy_item_id: string | null
  asin: string | null
  amazon_url: string | null
  ship_to: unknown
  state: FulfillmentState
  token_expires_at: string | null
  token_used_at: string | null
  last_error: string | null
  updated_at: string
}

async function ensureFulfillmentTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS fulfillment_jobs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      legacy_item_id TEXT,
      asin TEXT,
      amazon_url TEXT,
      ship_to JSONB NOT NULL DEFAULT '{}'::jsonb,
      state TEXT NOT NULL DEFAULT 'NOT_STARTED',
      token_hash TEXT UNIQUE,
      token_expires_at TIMESTAMPTZ,
      token_used_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {})

  await sql`CREATE INDEX IF NOT EXISTS fulfillment_jobs_user_idx ON fulfillment_jobs (user_id)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS fulfillment_jobs_user_order_idx ON fulfillment_jobs (user_id, order_id)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS fulfillment_jobs_state_idx ON fulfillment_jobs (state)`.catch(() => {})
}

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

export function normalizeShipTo(input: unknown): FulfillmentShipTo {
  if (!input || typeof input !== 'object') return {}
  const anyInput = input as Record<string, unknown>

  const fullName = String(anyInput.fullName || '').trim()
  const contact = (anyInput.contactAddress && typeof anyInput.contactAddress === 'object')
    ? anyInput.contactAddress as Record<string, unknown>
    : {}
  const primaryPhone = (anyInput.primaryPhone && typeof anyInput.primaryPhone === 'object')
    ? anyInput.primaryPhone as Record<string, unknown>
    : {}

  return {
    fullName: fullName || undefined,
    addressLine1: String(contact.addressLine1 || '').trim() || undefined,
    addressLine2: String(contact.addressLine2 || '').trim() || undefined,
    city: String(contact.city || '').trim() || undefined,
    stateOrProvince: String(contact.stateOrProvince || '').trim() || undefined,
    postalCode: String(contact.postalCode || '').trim() || undefined,
    countryCode: String(contact.countryCode || '').trim() || undefined,
    phoneNumber: String(primaryPhone.phoneNumber || '').trim() || undefined,
  }
}

export async function createFulfillmentJob(args: {
  userId: string
  orderId: string
  legacyItemId?: string | null
  asin?: string | null
  amazonUrl?: string | null
  shipTo: FulfillmentShipTo
  ttlMinutes?: number
}) {
  await ensureFulfillmentTables()

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256Hex(token)
  const ttlMinutes = Number.isFinite(args.ttlMinutes) && Number(args.ttlMinutes) > 0 ? Number(args.ttlMinutes) : 15

  const rows = await queryRows<{ id: string | number; amazon_url: string | null }>`
    INSERT INTO fulfillment_jobs (
      user_id,
      order_id,
      legacy_item_id,
      asin,
      amazon_url,
      ship_to,
      state,
      token_hash,
      token_expires_at,
      updated_at
    )
    VALUES (
      ${args.userId},
      ${args.orderId},
      ${args.legacyItemId || null},
      ${args.asin || null},
      ${args.amazonUrl || null},
      ${JSON.stringify(args.shipTo || {})},
      'NOT_STARTED',
      ${tokenHash},
      NOW() + (${ttlMinutes} * INTERVAL '1 minute'),
      NOW()
    )
    RETURNING id, amazon_url
  `

  return {
    token,
    jobId: String(rows[0]?.id || ''),
    amazonUrl: rows[0]?.amazon_url || args.amazonUrl || null,
  }
}

export async function consumeFulfillmentToken(token: string): Promise<FulfillmentJobRow | null> {
  await ensureFulfillmentTables()
  const tokenHash = sha256Hex(token)

  const rows = await queryRows<FulfillmentJobRow>`
    SELECT id, user_id, order_id, legacy_item_id, asin, amazon_url, ship_to, state, token_expires_at, token_used_at, last_error, updated_at
    FROM fulfillment_jobs
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `.catch(() => [])

  const job = rows[0]
  if (!job) return null

  const used = Boolean(job.token_used_at)
  const expired = job.token_expires_at ? new Date(job.token_expires_at).getTime() < Date.now() : true
  if (used || expired) return null

  await sql`
    UPDATE fulfillment_jobs
    SET token_used_at = NOW(),
        updated_at = NOW()
    WHERE id = ${job.id}
  `.catch(() => {})

  return job
}

export async function setFulfillmentState(args: {
  userId: string
  orderId: string
  legacyItemId?: string | null
  state: FulfillmentState
  lastError?: string | null
}) {
  await ensureFulfillmentTables()
  await sql`
    UPDATE fulfillment_jobs
    SET state = ${args.state},
        last_error = ${args.lastError || null},
        updated_at = NOW()
    WHERE user_id = ${args.userId}
      AND order_id = ${args.orderId}
      AND COALESCE(legacy_item_id, '') = COALESCE(${args.legacyItemId || null}, '')
  `.catch(() => {})
}

export async function setFulfillmentStateByToken(args: {
  token: string
  state: FulfillmentState
  lastError?: string | null
}) {
  await ensureFulfillmentTables()
  const tokenHash = sha256Hex(args.token)

  await sql`
    UPDATE fulfillment_jobs
    SET state = ${args.state},
        last_error = ${args.lastError || null},
        updated_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND token_expires_at IS NOT NULL
      AND token_expires_at > NOW()
  `.catch(() => {})
}

export async function getFulfillmentStates(args: {
  userId: string
  orderIds: string[]
}) {
  await ensureFulfillmentTables()
  const ids = (args.orderIds || []).map((id) => String(id || '').trim()).filter(Boolean)
  if (ids.length === 0) return []

  const rows = await queryRows<Pick<FulfillmentJobRow, 'order_id' | 'legacy_item_id' | 'state' | 'last_error' | 'updated_at'>>`
    SELECT order_id, legacy_item_id, state, last_error, updated_at
    FROM fulfillment_jobs
    WHERE user_id = ${args.userId}
      AND order_id = ANY(${ids})
    ORDER BY updated_at DESC
  `.catch(() => [])

  return rows
}

