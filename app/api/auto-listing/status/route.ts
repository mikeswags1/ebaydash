import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getAutoListingSettings } from '@/lib/auto-listing/settings'
import { countPostedToday, getQueueStats } from '@/lib/auto-listing/queue'
import { queryRows } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const settings = await getAutoListingSettings(session.user.id)
    const postedToday = await countPostedToday(session.user.id)
    const queue = await getQueueStats(session.user.id)

    const scoreRows = await queryRows<{ avg: number }>`
      SELECT COALESCE(AVG(score),0)::float AS avg
      FROM auto_listing_queue
      WHERE user_id = ${session.user.id}
        AND status IN ('queued','retry','processing')
    `.catch(() => [])
    const avgScore = scoreRows[0]?.avg || 0

    const profitRows = await queryRows<{ sum: number }>`
      SELECT COALESCE(SUM((score_breakdown->>'profit')::float),0)::float AS sum
      FROM auto_listing_queue
      WHERE user_id = ${session.user.id}
        AND status IN ('queued','retry','processing')
    `.catch(() => [])
    const estimatedDailyProfit = profitRows[0]?.sum || 0

    return apiOk({
      enabled: settings.enabled,
      paused: settings.paused,
      emergency_stopped: settings.emergency_stopped,
      postedToday,
      queue,
      avgScore,
      estimatedDailyProfit,
    })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load auto listing status.'), { status: 500, code: 'AUTO_LISTING_STATUS_LOAD_FAILED' })
  }
}

