import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows } from '@/lib/db'

const ADMIN_EMAILS = ['msawaged12@gmail.com', 'mikeswags1@gmail.com']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const [users, ebayConnected, activeListers, recentListers] = await Promise.all([
    queryRows<{ id: number; email: string; name: string; created_at: string }>`
      SELECT id, email, name, created_at FROM users ORDER BY created_at DESC
    `,
    queryRows<{ user_id: number; updated_at: string }>`
      SELECT user_id, updated_at FROM ebay_credentials
    `,
    queryRows<{ user_id: number; count: string }>`
      SELECT user_id, COUNT(*) as count FROM listed_asins
      GROUP BY user_id
    `,
    queryRows<{ user_id: number }>`
      SELECT DISTINCT user_id FROM listed_asins
      WHERE listed_at > NOW() - INTERVAL '30 days'
    `,
  ])

  const ebaySet = new Set(ebayConnected.map(r => r.user_id))
  const listingCountMap = new Map(activeListers.map(r => [r.user_id, Number(r.count)]))
  const recentSet = new Set(recentListers.map(r => r.user_id))

  const customers = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    joined: u.created_at,
    ebayConnected: ebaySet.has(u.id),
    totalListings: listingCountMap.get(u.id) || 0,
    activeRecently: recentSet.has(u.id),
  }))

  return apiOk({
    totalUsers: users.length,
    ebayConnected: ebaySet.size,
    activeRecently: recentSet.size,
    customers,
  })
}
