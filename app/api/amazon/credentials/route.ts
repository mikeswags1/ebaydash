import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { queryRows } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const rows = await queryRows<{ selling_partner_id?: string; updated_at?: string }>`
      SELECT selling_partner_id, token_expires_at, updated_at
      FROM amazon_credentials
      WHERE user_id = ${session.user.id}
    `

    if (!rows[0]) return apiOk({ connected: false })

    return apiOk({
      connected: true,
      sellingPartnerId: rows[0].selling_partner_id || '',
      updatedAt: rows[0].updated_at,
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load Amazon credentials.'), {
      status: 500,
      code: 'AMAZON_CREDENTIALS_LOAD_FAILED',
    })
  }
}
