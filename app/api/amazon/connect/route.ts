import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appId = process.env.AMAZON_APP_ID
  const redirectUri = process.env.AMAZON_REDIRECT_URI
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: 'Amazon SP-API not configured' }, { status: 500 })
  }

  const authUrl = `https://sellercentral.amazon.com/apps/authorize/consent?application_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${session.user.id}&version=beta`

  return NextResponse.redirect(authUrl)
}
