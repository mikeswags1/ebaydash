import { sql } from '@/lib/db'

export async function ensureAutoListingTables() {
  // Multi-account support (non-breaking): keep `ebay_credentials` as legacy default.
  await sql`
    CREATE TABLE IF NOT EXISTS ebay_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT 'Default',
      oauth_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMP,
      sandbox_mode BOOLEAN DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS ebay_accounts_user_idx ON ebay_accounts (user_id)`.catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ebay_accounts_user_label_unique_idx ON ebay_accounts (user_id, label)`.catch(() => {})

  // Auto listing settings (1 row per user).
  await sql`
    CREATE TABLE IF NOT EXISTS auto_listing_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      paused BOOLEAN NOT NULL DEFAULT FALSE,
      emergency_stopped BOOLEAN NOT NULL DEFAULT FALSE,
      listings_per_day INTEGER NOT NULL DEFAULT 100,
      max_per_hour INTEGER NOT NULL DEFAULT 25,
      cooldown_minutes INTEGER NOT NULL DEFAULT 3,
      selected_account_id INTEGER REFERENCES ebay_accounts(id),
      allowed_niches JSONB NOT NULL DEFAULT '[]'::jsonb,
      min_roi NUMERIC(8,2) NOT NULL DEFAULT 45,
      mode TEXT NOT NULL DEFAULT 'balanced',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {})

  // Queue + state machine.
  await sql`
    CREATE TABLE IF NOT EXISTS auto_listing_queue (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES ebay_accounts(id),
      asin TEXT NOT NULL,
      source_niche TEXT,
      category_id TEXT,
      score NUMERIC(12,2) NOT NULL DEFAULT 0,
      score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
      selected_reason TEXT,
      status TEXT NOT NULL DEFAULT 'queued', -- queued | processing | retry | failed | completed | stopped
      scheduled_at TIMESTAMPTZ,
      listed_at TIMESTAMPTZ,
      ebay_listing_id TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS auto_listing_queue_due_idx ON auto_listing_queue (status, scheduled_at)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS auto_listing_queue_user_idx ON auto_listing_queue (user_id, status, created_at DESC)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS auto_listing_queue_user_score_due_idx ON auto_listing_queue (user_id, status, score DESC, scheduled_at ASC)`.catch(() => {})
  // Prevent massive duplicate queueing: allow at most one active row per ASIN.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS auto_listing_queue_user_asin_active_unique_idx
    ON auto_listing_queue (user_id, asin)
    WHERE status IN ('queued','processing','retry')
  `.catch(() => {})

  // Event logging.
  await sql`
    CREATE TABLE IF NOT EXISTS auto_listing_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES ebay_accounts(id),
      queue_id BIGINT REFERENCES auto_listing_queue(id) ON DELETE SET NULL,
      asin TEXT,
      event_type TEXT NOT NULL, -- selected | validated | listed | failed | retry_scheduled | paused | resumed | stopped
      message TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS auto_listing_logs_user_time_idx ON auto_listing_logs (user_id, created_at DESC)`.catch(() => {})

  // Account-aware category performance + health.
  await sql`
    CREATE TABLE IF NOT EXISTS auto_listing_account_category_perf (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES ebay_accounts(id),
      category_id TEXT NOT NULL,
      listed_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      avg_roi NUMERIC(8,2) NOT NULL DEFAULT 0,
      avg_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, account_id, category_id)
    )
  `.catch(() => {})

  await sql`
    CREATE TABLE IF NOT EXISTS auto_listing_account_health (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES ebay_accounts(id),
      health_score NUMERIC(6,2) NOT NULL DEFAULT 1.0, -- 0.0..1.0
      risk_level TEXT NOT NULL DEFAULT 'normal', -- normal | cautious | restricted
      velocity_multiplier NUMERIC(6,2) NOT NULL DEFAULT 1.0, -- scales listings_per_day
      last_error TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, account_id)
    )
  `.catch(() => {})
}

