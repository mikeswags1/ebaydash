import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { EbayReconnectRequiredError, getValidEbayAccessToken } from '@/lib/ebay-auth'
import { sql } from '@/lib/db'

export const maxDuration = 300

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function endItem(itemId: string, accessToken: string, appId: string): Promise<{ ok: boolean; error?: string }> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${escapeXml(accessToken)}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`

  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'EndItem',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-APP-NAME': appId,
        'Content-Type': 'text/xml',
      },
      body: xml,
      signal: AbortSignal.timeout(12000),
    })
    const text = await res.text()
    if (/<Ack>Success<\/Ack>/i.test(text) || /<Ack>Warning<\/Ack>/i.test(text)) return { ok: true }
    const msg = text.match(/<LongMessage>(.*?)<\/LongMessage>/)?.[1] || 'Unknown error'
    return { ok: false, error: msg }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}

async function getActiveListingIds(accessToken: string, appId: string): Promise<string[]> {
  const ids: string[] = []

  for (let page = 1; page <= 10; page++) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${escapeXml(accessToken)}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>
  </ActiveList>
  <DetailLevel>ReturnSummary</DetailLevel>
</GetMyeBaySellingRequest>`

    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-APP-NAME': appId,
        'Content-Type': 'text/xml',
      },
      body: xml,
      signal: AbortSignal.timeout(20000),
    }).catch(() => null)

    if (!res) break
    const text = await res.text()
    const itemIds = [...text.matchAll(/<ItemID>(\d+)<\/ItemID>/g)].map(m => m[1])
    ids.push(...itemIds)
    if (itemIds.length < 200) break
  }

  return [...new Set(ids)]
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const { confirmed } = await req.json().catch(() => ({}))
  if (!confirmed) {
    return apiError('Pass { confirmed: true } to confirm you want to end all active listings.', { status: 400, code: 'NOT_CONFIRMED' })
  }

  try {
    const credentials = await getValidEbayAccessToken(session.user.id)
    if (!credentials?.accessToken) {
      return apiError('eBay session expired. Reconnect in Settings.', { status: 401, code: 'RECONNECT_REQUIRED' })
    }

    const appId = process.env.EBAY_APP_ID || ''
    const itemIds = await getActiveListingIds(credentials.accessToken, appId)

    if (itemIds.length === 0) {
      return apiOk({ ended: 0, failed: 0, message: 'No active listings found.' })
    }

    let ended = 0
    let failed = 0
    const BATCH = 5

    for (let i = 0; i < itemIds.length; i += BATCH) {
      const batch = itemIds.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map(id => endItem(id, credentials.accessToken, appId))
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) ended++
        else failed++
      }
    }

    // Mark all as ended in our DB
    await sql`UPDATE listed_asins SET ended_at = NOW() WHERE user_id = ${session.user.id} AND ended_at IS NULL`.catch(() => {})

    return apiOk({ ended, failed, total: itemIds.length, message: `Ended ${ended} listings.${failed > 0 ? ` ${failed} failed — may already be ended or sold.` : ''}` })
  } catch (error) {
    if (error instanceof EbayReconnectRequiredError) {
      return apiError('eBay session expired. Reconnect in Settings.', { status: 401, code: 'RECONNECT_REQUIRED' })
    }
    return apiError('Failed to end listings.', { status: 500, code: 'END_LISTINGS_FAILED' })
  }
}
