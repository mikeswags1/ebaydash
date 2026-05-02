import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'

const MARKETING_BASE = 'https://api.ebay.com/sell/marketing/v1'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect in Settings.', { status: 401, code: 'RECONNECT_REQUIRED' })
  }

  try {
    const res = await fetch(`${MARKETING_BASE}/ad_campaign?limit=50&campaign_type=PROMOTED_LISTINGS_STANDARD`, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const text = await res.text()
      const msg = text.match(/"message"\s*:\s*"([^"]+)"/)?.[1] || `eBay error ${res.status}`
      return apiError(msg, { status: res.status })
    }

    const data = await res.json() as { campaigns?: unknown[] }
    return apiOk({ campaigns: data.campaigns || [] })
  } catch {
    return apiError('Failed to load campaigns. Check your eBay connection.', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const body = await req.json().catch(() => ({})) as { name?: string; adRate?: string | number }
  const { name, adRate } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return apiError('Campaign name must be at least 2 characters.', { status: 400 })
  }
  const rate = parseFloat(String(adRate || ''))
  if (!Number.isFinite(rate) || rate < 1 || rate > 20) {
    return apiError('Ad rate must be between 1% and 20%.', { status: 400 })
  }

  const credentials = await getValidEbayAccessToken(session.user.id)
  if (!credentials?.accessToken) {
    return apiError('Your eBay session expired. Reconnect in Settings.', { status: 401, code: 'RECONNECT_REQUIRED' })
  }

  // eBay Marketing API requires full ISO 8601 timestamp for startDate
  const startDate = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')

  try {
    const res = await fetch(`${MARKETING_BASE}/ad_campaign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      body: JSON.stringify({
        campaignName: name.trim(),
        campaignType: 'PROMOTED_LISTINGS_STANDARD',
        fundingStrategy: {
          bidPercentage: rate.toFixed(1),
          fundingModel: 'COST_PER_SALE',
        },
        budgetType: 'UNLIMITED',
        startDate,
        marketplaceId: 'EBAY_US',
      }),
      signal: AbortSignal.timeout(12000),
    })

    const text = await res.text()
    if (!res.ok) {
      // Return full eBay error message for debugging
      let msg = `Failed to create campaign (${res.status})`
      try {
        const parsed = JSON.parse(text)
        const errors = parsed.errors || []
        msg = errors.map((e: { message?: string; longMessage?: string }) =>
          e.longMessage || e.message || ''
        ).filter(Boolean).join(' ') || parsed.message || msg
      } catch { /* use default msg */ }
      return apiError(msg, { status: res.status })
    }

    const data = JSON.parse(text) as { campaignId?: string }
    return apiOk({ campaignId: data.campaignId, message: `Campaign "${name.trim()}" created.` })
  } catch {
    return apiError('Failed to create campaign. Check your eBay connection.', { status: 500 })
  }
}
