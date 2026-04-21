import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { queryRows, sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const rows = await queryRows<{ niche?: string }>`SELECT niche FROM users WHERE id = ${session.user.id}`
    return apiOk({ niche: rows[0]?.niche || null })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load your niche.'), {
      status: 500,
      code: 'NICHE_LOAD_FAILED',
    })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const body = await req.json()
    const niche = typeof body?.niche === 'string' ? body.niche.trim() : ''
    if (!niche) return apiError('Niche is required.', { status: 400, code: 'NICHE_REQUIRED' })

    await sql`UPDATE users SET niche = ${niche} WHERE id = ${session.user.id}`
    return apiOk({ success: true, niche })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to save your niche.'), {
      status: 500,
      code: 'NICHE_SAVE_FAILED',
    })
  }
}
