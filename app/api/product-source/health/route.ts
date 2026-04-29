import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows } from '@/lib/db'
import { ensureProductSourceTables } from '@/lib/product-source-engine'

type SourceSummaryRow = {
  total?: number | string
  niches?: number | string
  stale?: number | string
  missing_images?: number | string
  high_risk?: number | string
  avg_score?: number | string | null
  newest_seen?: string | null
}

type NicheRow = {
  name?: string | null
  count?: number | string
  avg_score?: number | string | null
  max_score?: number | string | null
  newest_seen?: string | null
}

type CacheSummaryRow = {
  total_niches?: number | string
  ready_niches?: number | string
  stale_niches?: number | string
  total_products?: number | string
}

type ContinuousRow = {
  count?: number | string
  version?: number | string
  cached_at?: string | null
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIso(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  await ensureProductSourceTables().catch(() => {})

  const sourceRows = await queryRows<SourceSummaryRow>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT source_niche)::int AS niches,
      COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '7 days')::int AS stale,
      COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '')::int AS missing_images,
      COUNT(*) FILTER (WHERE risk = 'HIGH')::int AS high_risk,
      ROUND(AVG(total_score), 2) AS avg_score,
      MAX(last_seen_at) AS newest_seen
    FROM product_source_items
    WHERE active = TRUE
  `.catch(() => [])

  const nicheRows = await queryRows<NicheRow>`
    SELECT
      COALESCE(source_niche, 'Unassigned') AS name,
      COUNT(*)::int AS count,
      ROUND(AVG(total_score), 2) AS avg_score,
      ROUND(MAX(total_score), 2) AS max_score,
      MAX(last_seen_at) AS newest_seen
    FROM product_source_items
    WHERE active = TRUE
    GROUP BY COALESCE(source_niche, 'Unassigned')
    ORDER BY count DESC, avg_score DESC
    LIMIT 12
  `.catch(() => [])

  const cacheRows = await queryRows<CacheSummaryRow>`
    SELECT
      COUNT(*) FILTER (WHERE niche <> '__continuous_listing__')::int AS total_niches,
      COUNT(*) FILTER (WHERE niche <> '__continuous_listing__' AND jsonb_array_length(results) >= 30)::int AS ready_niches,
      COUNT(*) FILTER (WHERE niche <> '__continuous_listing__' AND cached_at < NOW() - INTERVAL '24 hours')::int AS stale_niches,
      COALESCE(SUM(jsonb_array_length(results)) FILTER (WHERE niche <> '__continuous_listing__'), 0)::int AS total_products
    FROM product_cache
  `.catch(() => [])

  const continuousRows = await queryRows<ContinuousRow>`
    SELECT jsonb_array_length(results)::int AS count, version, cached_at
    FROM product_cache
    WHERE niche = '__continuous_listing__'
  `.catch(() => [])

  const source = sourceRows[0] || {}
  const cache = cacheRows[0] || {}
  const continuous = continuousRows[0] || {}
  const sourceTotal = toNumber(source.total)
  const readyNiches = toNumber(cache.ready_niches)
  const totalNiches = toNumber(cache.total_niches)
  const continuousCount = toNumber(continuous.count)

  const warnings: string[] = []
  if (sourceTotal < 900) warnings.push('Source engine pool is below the preferred 900-product floor.')
  if (continuousCount < 30) warnings.push('Continuous Listing pool has fewer than 30 products ready.')
  if (totalNiches > 0 && readyNiches < Math.max(1, Math.floor(totalNiches * 0.7))) warnings.push('Several niche caches are below 30 products.')
  if (toNumber(source.stale) > sourceTotal * 0.45) warnings.push('A large share of source products are older than 7 days.')
  if (toNumber(source.missing_images) > sourceTotal * 0.1) warnings.push('More than 10% of source products are missing images.')

  const status = warnings.length === 0 ? 'healthy' : warnings.length <= 2 ? 'watch' : 'attention'

  return apiOk({
    generatedAt: new Date().toISOString(),
    status,
    warnings,
    sourceEngine: {
      totalProducts: sourceTotal,
      niches: toNumber(source.niches),
      staleProducts: toNumber(source.stale),
      missingImages: toNumber(source.missing_images),
      highRiskProducts: toNumber(source.high_risk),
      averageScore: toNumber(source.avg_score),
      newestSeenAt: toIso(source.newest_seen),
    },
    cache: {
      totalNiches,
      readyNiches,
      staleNiches: toNumber(cache.stale_niches),
      totalProducts: toNumber(cache.total_products),
    },
    continuous: {
      products: continuousCount,
      version: toNumber(continuous.version),
      cachedAt: toIso(continuous.cached_at),
    },
    topNiches: nicheRows.map((row) => ({
      name: row.name || 'Unassigned',
      count: toNumber(row.count),
      averageScore: toNumber(row.avg_score),
      maxScore: toNumber(row.max_score),
      newestSeenAt: toIso(row.newest_seen),
    })),
    providers: {
      rapidApiConfigured: Boolean(process.env.RAPIDAPI_KEY),
      liveProviderChecks: 'manual-only',
    },
  })
}
