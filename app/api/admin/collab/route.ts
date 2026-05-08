import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

const ADMIN_EMAILS = ['msawaged12@gmail.com', 'mikeswags1@gmail.com']

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const collabPath = join(process.cwd(), 'COLLAB.md')
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA || null
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || null
  const env = process.env.VERCEL_ENV || null

  try {
    const [st, content] = await Promise.all([stat(collabPath), readFile(collabPath, 'utf-8')])
    return apiOk(
      {
        content,
        fileMtime: new Date(st.mtimeMs).toISOString(),
        gitSha,
        deploymentId,
        env,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch {
    return apiOk(
      { content: 'COLLAB.md not found.', fileMtime: null, gitSha, deploymentId, env },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  }
}
