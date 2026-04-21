import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EBAY_OAUTH_SCOPES } from '@/lib/ebay-auth'

const SCOPES = encodeURIComponent(EBAY_OAUTH_SCOPES.join(' '))

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url =
    `https://auth.ebay.com/oauth2/authorize` +
    `?client_id=${process.env.EBAY_APP_ID}` +
    `&response_type=code` +
    `&redirect_uri=${process.env.EBAY_RUNAME}` +
    `&scope=${SCOPES}` +
    `&state=${session.user.id}`

  return NextResponse.redirect(url)
}
