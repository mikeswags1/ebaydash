import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT app_id, cert_id, dev_id, sandbox_mode,
           (oauth_token IS NOT NULL AND oauth_token != '') AS has_token
    FROM ebay_credentials WHERE user_id = ${session.user.id}
  `
  return NextResponse.json({ credentials: rows[0] || null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, cert_id, dev_id, oauth_token, sandbox_mode } = await req.json()

  await sql`
    INSERT INTO ebay_credentials (user_id, app_id, cert_id, dev_id, oauth_token, sandbox_mode, updated_at)
    VALUES (${session.user.id}, ${app_id || ''}, ${cert_id || ''}, ${dev_id || ''}, ${oauth_token || ''}, ${sandbox_mode ?? false}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      app_id = ${app_id || ''},
      cert_id = ${cert_id || ''},
      dev_id = ${dev_id || ''},
      oauth_token = ${oauth_token || ''},
      sandbox_mode = ${sandbox_mode ?? false},
      updated_at = NOW()
  `
  return NextResponse.json({ success: true })
}
