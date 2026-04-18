import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
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
        sandbox_mode BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    return NextResponse.json({ success: true, message: 'Database tables ready' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
