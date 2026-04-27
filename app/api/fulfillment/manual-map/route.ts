import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { fetchAmazonProductByAsin } from '@/lib/amazon-product'
import { getEbayItemDetails, saveRecoveredMapping } from '@/lib/amazon-mapping'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const body = await req.json()
    const itemId = String(body?.itemId || '').trim()
    const asin = String(body?.asin || '').trim().toUpperCase()

    if (!itemId || !/^\d+$/.test(itemId)) {
      return apiError('Invalid eBay item ID.', { status: 400, code: 'INVALID_ITEM_ID' })
    }

    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      return apiError('Invalid ASIN. It must be 10 characters.', { status: 400, code: 'INVALID_ASIN' })
    }

    const product = await fetchAmazonProductByAsin({ asin, strictAsin: true })
    if (!product) {
      return apiError('ASIN validation failed. Confirm the Amazon product has a title, price, and image.', {
        status: 404,
        code: 'ASIN_VALIDATION_FAILED',
      })
    }

    const credentials = await getValidEbayAccessToken(session.user.id)
    const details = credentials?.accessToken
      ? await getEbayItemDetails(itemId, credentials.accessToken, process.env.EBAY_APP_ID || '').catch(() => null)
      : null

    await saveRecoveredMapping({
      userId: session.user.id,
      itemId,
      asin: product.asin,
      title: product.title,
      amazonPrice: product.amazonPrice,
      amazonImageUrl: product.imageUrl,
      amazonImages: product.images,
      amazonSnapshot: {
        asin: product.asin,
        title: product.title,
        amazonPrice: product.amazonPrice,
        imageUrl: product.imageUrl,
        images: product.images,
        features: product.features,
        description: product.description,
        specs: product.specs,
        available: product.available,
        source: product.source,
        amazonUrl: `https://www.amazon.com/dp/${product.asin}`,
        recoveredFrom: 'manual_confirmed',
        ebayTitle: details?.title || null,
      },
    })

    return apiOk({
      asin: product.asin,
      title: product.title,
      amazonPrice: product.amazonPrice,
      imageUrl: product.imageUrl,
      images: product.images,
      features: product.features,
      description: product.description,
      specs: product.specs,
      available: product.available,
      amazonUrl: `https://www.amazon.com/dp/${product.asin}`,
      ebayTitle: details?.title || undefined,
      source: 'manual',
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to save the ASIN mapping.'), {
      status: 500,
      code: 'ASIN_MAPPING_SAVE_FAILED',
    })
  }
}
