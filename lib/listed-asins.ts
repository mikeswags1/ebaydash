import { sql } from '@/lib/db'

export async function ensureListedAsinsFinancialColumns() {
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_price NUMERIC(10,2)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ebay_price NUMERIC(10,2)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ebay_fee_rate NUMERIC(6,4)`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_image_url TEXT`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS amazon_images JSONB`.catch(() => {})
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`.catch(() => {})
}
