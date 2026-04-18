import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.length > 0) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })

    const hash = await bcrypt.hash(password, 12)
    await sql`INSERT INTO users (email, password_hash, name) VALUES (${email}, ${hash}, ${name || email})`

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
