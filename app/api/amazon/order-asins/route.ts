import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await sql`
      SELECT asin, ebay_listing_id, title
      FROM listed_asins
      WHERE user_id = ${session.user.id}
        AND ebay_listing_id IS NOT NULL
    `
    const map: Record<string, { asin: string; title: string }> = {}
    for (const r of rows) {
      if (r.ebay_listing_id) {
        map[String(r.ebay_listing_id)] = { asin: String(r.asin), title: String(r.title || '') }
      }
    }
    return NextResponse.json({ map })
  } catch {
    return NextResponse.json({ map: {} })
  }
}
