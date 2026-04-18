import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT oauth_token, sandbox_mode FROM ebay_credentials WHERE user_id = ${session.user.id}`
  const creds = rows[0]

  if (!creds?.oauth_token) {
    return NextResponse.json({ connected: false, error: 'No eBay credentials saved' })
  }

  const base = creds.sandbox_mode ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'

  try {
    const [awaitingRes, recentRes] = await Promise.all([
      fetch(`${base}/sell/fulfillment/v1/order?limit=50&ordersFulfillmentStatus=NOT_STARTED`, {
        headers: { Authorization: `Bearer ${creds.oauth_token}`, 'Content-Language': 'en-US' },
      }),
      fetch(`${base}/sell/fulfillment/v1/order?limit=50`, {
        headers: { Authorization: `Bearer ${creds.oauth_token}`, 'Content-Language': 'en-US' },
      }),
    ])

    if (!awaitingRes.ok) {
      const txt = await awaitingRes.text()
      return NextResponse.json({ connected: false, error: `eBay API ${awaitingRes.status}`, detail: txt })
    }

    const [awaiting, recent] = await Promise.all([awaitingRes.json(), recentRes.json()])

    return NextResponse.json({
      connected: true,
      awaiting: awaiting.orders || [],
      recent: recent.orders || [],
      total: recent.total || 0,
    })
  } catch (e) {
    return NextResponse.json({ connected: false, error: String(e) })
  }
}
