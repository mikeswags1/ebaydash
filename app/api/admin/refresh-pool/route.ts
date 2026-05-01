import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'

const ADMIN_EMAILS = ['msawaged12@gmail.com', 'mikeswags1@gmail.com']

export const maxDuration = 300

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const { mode = 'catalog' } = await req.json().catch(() => ({}))

  // Call our own cron with the internal CRON_SECRET
  const cronSecret = process.env.CRON_SECRET || ''
  const host = new URL(req.url).origin
  const param = mode === 'catalog' ? '?catalog=1' : '?sourceOnly=1'

  const res = await fetch(`${host}/api/cron/refresh-products${param}`, {
    headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    signal: AbortSignal.timeout(290000),
  })

  const data = await res.json().catch(() => ({}))
  return apiOk({ triggered: true, mode, result: data })
}
