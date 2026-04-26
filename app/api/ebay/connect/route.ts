import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EBAY_MINIMAL_OAUTH_SCOPES, EBAY_OAUTH_SCOPES } from '@/lib/ebay-auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = String(process.env.EBAY_APP_ID || '').trim()
  const redirectUri = String(process.env.EBAY_RUNAME || '').trim()

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL('/dashboard?ebay=error&msg=eBay%20OAuth%20is%20not%20configured.', process.env.NEXTAUTH_URL || 'https://ebaydash.vercel.app'))
  }

  const url = new URL('https://auth.ebay.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', String(session.user.id))
  url.searchParams.set('prompt', 'login')
  url.searchParams.set('locale', 'en-US')

  const scopes = req.nextUrl.searchParams.get('minimal') === '1'
    ? EBAY_MINIMAL_OAUTH_SCOPES
    : EBAY_OAUTH_SCOPES

  // eBay examples show scopes as a URL-encoded space-separated list (%20).
  // URLSearchParams serializes spaces as "+", so set scope explicitly.
  url.search = `${url.search}&scope=${encodeURIComponent(scopes.join(' '))}`

  return NextResponse.redirect(url.toString())
}
