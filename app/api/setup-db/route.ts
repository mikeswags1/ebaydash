import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS ebay_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        app_id VARCHAR(500),
        cert_id VARCHAR(500),
        dev_id VARCHAR(500),
        oauth_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        sandbox_mode BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS amazon_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        selling_partner_id VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS listed_asins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        asin VARCHAR(20) NOT NULL,
        title TEXT,
        ebay_listing_id VARCHAR(50),
        listed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, asin)
      )
    `
    // Allow Google OAuth users (no password)
    await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`.catch(() => {})
    // Add missing columns if they don't exist
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS niche VARCHAR(100)`.catch(() => {})
    await sql`ALTER TABLE ebay_credentials ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP`.catch(() => {})
    await sql`ALTER TABLE ebay_credentials ADD COLUMN IF NOT EXISTS refresh_token TEXT`.catch(() => {})
    await ensureListedAsinsFinancialColumns()
    return NextResponse.json({ success: true, message: 'Database tables ready' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
