import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { ensureAutoListingTables } from '@/lib/auto-listing/db'
import { queryRows } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    await ensureAutoListingTables()
    const rows = await queryRows<{ id: number; label: string; sandbox_mode: boolean; active: boolean; updated_at: string }>`
      SELECT id, label, sandbox_mode, active, updated_at
      FROM ebay_accounts
      WHERE user_id = ${session.user.id}
      ORDER BY id ASC
    `.catch(() => [])

    return apiOk({
      accounts: rows.map((r) => ({
        id: r.id,
        label: r.label || 'Default',
        sandbox_mode: Boolean(r.sandbox_mode),
        active: Boolean(r.active),
        updated_at: r.updated_at,
      })),
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load eBay accounts.'), {
      status: 500,
      code: 'EBAY_ACCOUNTS_LOAD_FAILED',
    })
  }
}

