import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
].join('%20')

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
