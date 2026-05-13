import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  loadCustomSourceNicheRows,
  setCustomSourceNicheActive,
  TRENDING_NEW_NICHE_QUERIES,
  upsertCustomSourceNiche,
} from '@/lib/source-niches'

const ADMIN_EMAILS = ['msawaged12@gmail.com', 'mikeswags1@gmail.com']

function isAdmin(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email))
}

function normalizeQueries(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session?.user?.email)) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }
  return null
}

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const customRows = await loadCustomSourceNicheRows()
  return apiOk({
    defaultTrendingNiches: Object.entries(TRENDING_NEW_NICHE_QUERIES).map(([name, queries]) => ({
      name,
      queryCount: queries.length,
      active: true,
      locked: true,
    })),
    customNiches: customRows.map((row) => ({
      name: row.name,
      queries: Array.isArray(row.queries) ? row.queries.map((entry) => String(entry || '')) : [],
      active: Boolean(row.active),
      notes: row.notes || '',
      updatedAt: row.updated_at || null,
    })),
  })
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  try {
    const body = await req.json().catch(() => ({}))
    const saved = await upsertCustomSourceNiche({
      name: String(body.name || ''),
      queries: normalizeQueries(body.queries),
      active: body.active !== false,
      notes: typeof body.notes === 'string' ? body.notes : '',
    })
    return apiOk({ saved })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unable to save source niche.', {
      status: 400,
      code: 'SOURCE_NICHE_SAVE_FAILED',
    })
  }
}

export async function PATCH(req: Request) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body.queries) || typeof body.queries === 'string') {
      const saved = await upsertCustomSourceNiche({
        name: String(body.name || ''),
        queries: normalizeQueries(body.queries),
        active: body.active !== false,
        notes: typeof body.notes === 'string' ? body.notes : '',
      })
      return apiOk({ saved })
    }
    const updated = await setCustomSourceNicheActive(String(body.name || ''), body.active !== false)
    return apiOk({ updated })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unable to update source niche.', {
      status: 400,
      code: 'SOURCE_NICHE_UPDATE_FAILED',
    })
  }
}

export async function DELETE(req: Request) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || ''
    const updated = await setCustomSourceNicheActive(name, false)
    return apiOk({ updated })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unable to remove source niche.', {
      status: 400,
      code: 'SOURCE_NICHE_REMOVE_FAILED',
    })
  }
}
