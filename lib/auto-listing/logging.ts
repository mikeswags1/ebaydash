import { ensureAutoListingTables } from '@/lib/auto-listing/db'
import { sql } from '@/lib/db'

export async function logAutoListingEvent(input: {
  userId: string | number
  accountId?: number | null
  queueId?: string | number | null
  asin?: string | null
  eventType: string
  message?: string | null
  data?: Record<string, unknown>
}) {
  await ensureAutoListingTables()
  await sql`
    INSERT INTO auto_listing_logs (user_id, account_id, queue_id, asin, event_type, message, data)
    VALUES (
      ${input.userId},
      ${input.accountId ?? null},
      ${input.queueId ?? null},
      ${input.asin ?? null},
      ${input.eventType},
      ${input.message ?? null},
      ${JSON.stringify(input.data || {})}
    )
  `.catch(() => {})
}

