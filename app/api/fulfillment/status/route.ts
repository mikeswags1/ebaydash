import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getFulfillmentStates, setFulfillmentState, setFulfillmentStateByToken, type FulfillmentState } from '@/lib/fulfillment'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isFulfillmentState(value: unknown): value is FulfillmentState {
  return value === 'NOT_STARTED' || value === 'PREFILLED' || value === 'PURCHASED' || value === 'ISSUE'
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  const orderIds = (req.nextUrl.searchParams.get('orderIds') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const rows = await getFulfillmentStates({ userId: session.user.id, orderIds })
  return apiOk({ rows }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown>
    const state = body?.state
    const lastError = body?.lastError ? String(body.lastError).slice(0, 1200) : null

    if (!isFulfillmentState(state)) {
      return apiError('Invalid state.', { status: 400, code: 'INVALID_STATE' })
    }

    const token = body?.token ? String(body.token).trim() : ''
    if (token) {
      await setFulfillmentStateByToken({ token, state, lastError })
      return apiOk({ state })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

    const orderId = String(body?.orderId || '').trim()
    const legacyItemId = body?.legacyItemId ? String(body.legacyItemId).trim() : null
    if (!orderId) return apiError('Missing orderId.', { status: 400, code: 'MISSING_ORDER_ID' })

    await setFulfillmentState({
      userId: session.user.id,
      orderId,
      legacyItemId,
      state,
      lastError,
    })

    return apiOk({ state })
  } catch (error) {
    return apiError(getErrorText(error, 'Failed to update fulfillment state.'), { status: 500, code: 'FULFILLMENT_STATUS_FAILED' })
  }
}
