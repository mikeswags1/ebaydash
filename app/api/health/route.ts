import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Lightweight readiness probe for uptime monitors and release verification.
 * Never exposes secret values — only booleans that required env vars are set.
 */
export async function GET() {
  let databasePing = false
  try {
    await sql`SELECT 1 AS ping`
    databasePing = true
  } catch {
    databasePing = false
  }

  const envFlags = {
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    nextAuthUrl: Boolean(process.env.NEXTAUTH_URL?.trim()),
    /** Minimum for eBay OAuth connect + Trading API calls */
    ebayOAuthConfigured: Boolean(
      process.env.EBAY_APP_ID?.trim() &&
        process.env.EBAY_CERT_ID?.trim() &&
        process.env.EBAY_RUNAME?.trim()
    ),
    cronSecretSet: Boolean(process.env.CRON_SECRET?.trim()),
  }

  const criticalOk = envFlags.databaseUrl && databasePing && envFlags.nextAuthSecret

  const body = {
    ok: criticalOk,
    status: criticalOk ? 'healthy' : 'degraded',
    checks: {
      databasePing,
      env: envFlags,
    },
    meta: {
      vercelGitCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      nodeEnv: process.env.NODE_ENV || null,
      timestamp: new Date().toISOString(),
    },
  }

  return NextResponse.json(body, { status: criticalOk ? 200 : 503 })
}
