import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await sql`
      SELECT selling_partner_id, token_expires_at, updated_at
      FROM amazon_credentials WHERE user_id = ${session.user.id}
    `
    if (!rows[0]) return NextResponse.json({ connected: false })
    return NextResponse.json({ connected: true, sellingPartnerId: rows[0].selling_partner_id, updatedAt: rows[0].updated_at })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
