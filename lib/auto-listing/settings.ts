import { ensureAutoListingTables } from '@/lib/auto-listing/db'
import { queryRows, sql } from '@/lib/db'
import type { AutoListingSettings, AutoListingMode } from '@/lib/auto-listing/types'

const DEFAULTS: AutoListingSettings = {
  enabled: false,
  paused: false,
  emergency_stopped: false,
  listings_per_day: 100,
  max_per_hour: 25,
  cooldown_minutes: 3,
  selected_account_id: null,
  allowed_niches: [],
  min_roi: 45,
  mode: 'balanced',
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function clampFloat(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function asMode(value: unknown): AutoListingMode {
  return value === 'safe' || value === 'aggressive' ? value : 'balanced'
}

export async function getAutoListingSettings(userId: string | number): Promise<AutoListingSettings> {
  await ensureAutoListingTables()
  const rows = await queryRows<{
    enabled: boolean
    paused: boolean
    emergency_stopped: boolean
    listings_per_day: number
    max_per_hour: number
    cooldown_minutes: number
    selected_account_id: number | null
    allowed_niches: unknown
    min_roi: number
    mode: string
    updated_at: string
  }>`
    SELECT enabled, paused, emergency_stopped, listings_per_day, max_per_hour, cooldown_minutes,
           selected_account_id, allowed_niches, min_roi, mode, updated_at
    FROM auto_listing_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `.catch(() => [])

  if (!rows[0]) {
    await sql`
      INSERT INTO auto_listing_settings (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `.catch(() => {})
    return { ...DEFAULTS }
  }

  const r = rows[0]
  return {
    enabled: Boolean(r.enabled),
    paused: Boolean(r.paused),
    emergency_stopped: Boolean(r.emergency_stopped),
    listings_per_day: clampInt(r.listings_per_day, 1, 2000, DEFAULTS.listings_per_day),
    max_per_hour: clampInt(r.max_per_hour, 1, 250, DEFAULTS.max_per_hour),
    cooldown_minutes: clampInt(r.cooldown_minutes, 0, 120, DEFAULTS.cooldown_minutes),
    selected_account_id: r.selected_account_id ?? null,
    allowed_niches: Array.isArray(r.allowed_niches) ? (r.allowed_niches as string[]).filter(Boolean) : DEFAULTS.allowed_niches,
    min_roi: clampFloat(r.min_roi, 0, 500, DEFAULTS.min_roi),
    mode: asMode(r.mode),
    updated_at: r.updated_at,
  }
}

export async function upsertAutoListingSettings(userId: string | number, input: Partial<AutoListingSettings>) {
  await ensureAutoListingTables()
  const current = await getAutoListingSettings(userId)

  const next: AutoListingSettings = {
    ...current,
    enabled: input.enabled ?? current.enabled,
    paused: input.paused ?? current.paused,
    emergency_stopped: input.emergency_stopped ?? current.emergency_stopped,
    listings_per_day: input.listings_per_day !== undefined ? clampInt(input.listings_per_day, 1, 2000, current.listings_per_day) : current.listings_per_day,
    max_per_hour: input.max_per_hour !== undefined ? clampInt(input.max_per_hour, 1, 250, current.max_per_hour) : current.max_per_hour,
    cooldown_minutes: input.cooldown_minutes !== undefined ? clampInt(input.cooldown_minutes, 0, 120, current.cooldown_minutes) : current.cooldown_minutes,
    selected_account_id: input.selected_account_id !== undefined ? (input.selected_account_id ?? null) : current.selected_account_id,
    allowed_niches: input.allowed_niches !== undefined ? (Array.isArray(input.allowed_niches) ? input.allowed_niches.filter(Boolean) : []) : current.allowed_niches,
    min_roi: input.min_roi !== undefined ? clampFloat(input.min_roi, 0, 500, current.min_roi) : current.min_roi,
    mode: input.mode !== undefined ? asMode(input.mode) : current.mode,
  }

  await sql`
    INSERT INTO auto_listing_settings (
      user_id, enabled, paused, emergency_stopped, listings_per_day, max_per_hour, cooldown_minutes,
      selected_account_id, allowed_niches, min_roi, mode, updated_at
    )
    VALUES (
      ${userId}, ${next.enabled}, ${next.paused}, ${next.emergency_stopped}, ${next.listings_per_day}, ${next.max_per_hour}, ${next.cooldown_minutes},
      ${next.selected_account_id}, ${JSON.stringify(next.allowed_niches)}, ${next.min_roi}, ${next.mode}, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      paused = EXCLUDED.paused,
      emergency_stopped = EXCLUDED.emergency_stopped,
      listings_per_day = EXCLUDED.listings_per_day,
      max_per_hour = EXCLUDED.max_per_hour,
      cooldown_minutes = EXCLUDED.cooldown_minutes,
      selected_account_id = EXCLUDED.selected_account_id,
      allowed_niches = EXCLUDED.allowed_niches,
      min_roi = EXCLUDED.min_roi,
      mode = EXCLUDED.mode,
      updated_at = NOW()
  `.catch(() => {})

  return next
}

