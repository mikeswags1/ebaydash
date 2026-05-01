import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { readFile } from 'fs/promises'
import { join } from 'path'

const ADMIN_EMAILS = ['msawaged12@gmail.com', 'mikeswags1@gmail.com']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  try {
    const content = await readFile(join(process.cwd(), 'COLLAB.md'), 'utf-8')
    return apiOk({ content })
  } catch {
    return apiOk({ content: 'COLLAB.md not found.' })
  }
}
