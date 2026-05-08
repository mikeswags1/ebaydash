import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'
import { getAutoListingSettings, upsertAutoListingSettings } from '@/lib/auto-listing/settings'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const settings = await getAutoListingSettings(session.user.id)
    return apiOk({ settings })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to load auto listing settings.'), { status: 500, code: 'AUTO_LISTING_SETTINGS_LOAD_FAILED' })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  try {
    const input = await req.json().catch(() => ({}))
    const settings = await upsertAutoListingSettings(session.user.id, input || {})
    return apiOk({ settings })
  } catch (error) {
    return apiError(getErrorText(error, 'Unable to save auto listing settings.'), { status: 500, code: 'AUTO_LISTING_SETTINGS_SAVE_FAILED' })
  }
}

