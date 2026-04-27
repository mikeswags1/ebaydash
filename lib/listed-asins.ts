import { sql } from '@/lib/db'

export async function ensureListedAsinsFinancialColumns() {
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_price NUMERIC(10,2)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ebay_price NUMERIC(10,2)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ebay_fee_rate NUMERIC(6,4)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_image_url TEXT`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_images JSONB`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_snapshot JSONB`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS niche VARCHAR(100)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS category_id VARCHAR(50)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS category_name TEXT`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS listed_asins_user_listing_idx ON listed_asins (user_id, ebay_listing_id)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS listed_asins_user_niche_idx ON listed_asins (user_id, niche)`.catch(() => {})
}
