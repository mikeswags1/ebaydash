import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'

const MARKETING_BASE = 'https://api.ebay.com/sell/marketing/v1'

// Pause or resume a campaign
export async function PATCH(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const { action } = await req.json().catch(() => ({})) as { action?: string }
  if (action !== 'pause' && action !== 'resume') {
    return apiError('action must be "pause" or "resume".', { status: 400 })
  }

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect in Settings.', { status: 401, code: 'RECONNECT_REQUIRED' })
  }

  const { campaignId } = await context.params

  try {
    const res = await fetch(`${MARKETING_BASE}/ad_campaign/${campaignId}/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const text = await res.text()
      const msg = text.match(/"message"\s*:\s*"([^"]+)"/)?.[1] || `Failed to ${action} campaign`
      return apiError(msg, { status: res.status })
    }

    return apiOk({ message: `Campaign ${action === 'pause' ? 'paused' : 'resumed'}.` })
  } catch {
    return apiError(`Failed to ${action} campaign.`, { status: 500 })
  }
}
