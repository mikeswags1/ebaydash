import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'

async function ebayGet(token: string, path: string) {
  const res = await fetch(`https://api.ebay.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`eBay API request failed (${res.status})`)
  }

  return res.json()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const script = req.nextUrl.searchParams.get('script')
  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('eBay is not connected. Open Settings and reconnect your account.', {
      status: 401,
      code: 'RECONNECT_REQUIRED',
    })
  }

  try {
    switch (script) {
      case 'check-orders.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/fulfillment/v1/order?limit=50&orderFulfillmentStatus=NOT_STARTED')
        const count = data.total || 0
        return apiOk({ message: `Found ${count} order${count !== 1 ? 's' : ''} needing shipment.` })
      }

      case 'auto-feedback.js':
        return apiOk({ message: 'eBay no longer allows sellers to initiate buyer messages through the API. Send feedback requests manually from My eBay > Sold.' })

      case 'fix-campaigns.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/marketing/v1/ad_campaign?limit=10')
        const campaigns = data.campaigns || []
        const paused = campaigns.filter((campaign: { campaignStatus: string }) => campaign.campaignStatus === 'PAUSED').length
        return apiOk({ message: `Found ${campaigns.length} campaign(s); ${paused} are paused. Review them in eBay Seller Hub > Marketing.` })
      }

      case 'delete-low-roi.js':
        return apiOk({ message: 'This script permanently deletes listings. Run it locally for safety: node delete-low-roi.js' })

      case 'audit-and-clean.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/inventory/v1/inventory_item?limit=200')
        const count = data.total || (data.inventoryItems?.length ?? 0)
        return apiOk({ message: `Found ${count} inventory item(s). Run the full audit locally with: node audit-and-clean.js` })
      }

      case 'delete-dead-listings.js':
        return apiOk({ message: 'Deletion scripts run locally for safety. Use: node delete-dead-listings.js' })

      case 'optimize-titles.js': {
        const data = await ebayGet(credentials.accessToken, '/sell/inventory/v1/inventory_item?limit=200')
        const count = data.total || (data.inventoryItems?.length ?? 0)
        return apiOk({ message: `Found ${count} listing(s). Title optimization runs locally: node optimize-titles.js` })
      }

      case 'optimize-titles-apply.js':
        return apiOk({ message: 'Title changes apply live to your listings. Run locally after reviewing the report: node optimize-titles-apply.js' })

      case 'auto-lister.js':
        return apiOk({ message: 'Auto-lister requires a product data file. Run locally: node auto-lister.js' })

      case 'update-descriptions.js':
        return apiOk({ message: 'Description updates run locally. Use: node update-descriptions.js' })

      case 'sync-amazon-costs.js':
        return apiOk({ message: 'Cost sync runs locally. Use: node sync-amazon-costs.js or check prices manually in the ASIN tab.' })

      default:
        return apiError('Script not recognized.', { status: 400, code: 'UNKNOWN_SCRIPT' })
    }
  } catch (error) {
    return apiError(getErrorText(error, 'Failed to run script.'), {
      status: 500,
      code: 'SCRIPT_RUN_FAILED',
    })
  }
}
