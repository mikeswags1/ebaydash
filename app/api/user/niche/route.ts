import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT niche FROM users WHERE id = ${session.user.id}`
  return NextResponse.json({ niche: rows[0]?.niche || null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { niche } = await req.json()
  if (!niche) return NextResponse.json({ error: 'Niche required' }, { status: 400 })

  await sql`UPDATE users SET niche = ${niche} WHERE id = ${session.user.id}`
  return NextResponse.json({ success: true, niche })
}
