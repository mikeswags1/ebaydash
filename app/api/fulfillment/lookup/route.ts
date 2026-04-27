import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { recoverAmazonProductByItemId } from '@/lib/amazon-mapping'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const itemId = req.nextUrl.searchParams.get('itemId')?.trim()
  const excludeAsins = (req.nextUrl.searchParams.get('exclude') || '')
    .split(',')
    .map((asin) => asin.trim().toUpperCase())
    .filter((asin) => /^[A-Z0-9]{10}$/.test(asin))
  if (!itemId || !/^\d+$/.test(itemId)) {
    return apiError('Invalid eBay item ID.', { status: 400, code: 'INVALID_ITEM_ID' })
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    return apiError('Amazon product lookup is not configured.', {
      status: 503,
      code: 'AMAZON_LOOKUP_NOT_CONFIGURED',
    })
  }

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect your account in Settings.', {
      status: 401,
      code: 'RECONNECT_REQUIRED',
    })
  }

  const appId = process.env.EBAY_APP_ID || ''
  const recovered = await recoverAmazonProductByItemId({
    userId: session.user.id,
    itemId,
    accessToken: credentials.accessToken,
    appId,
    rapidKey,
    excludeAsins,
  })

  if (!recovered) {
    return apiError(`No Amazon match was found for item #${itemId}. Try the title manually if this listing uses custom wording.`, {
      status: 404,
      code: 'AMAZON_MATCH_NOT_FOUND',
    })
  }

  return apiOk(recovered)
}
