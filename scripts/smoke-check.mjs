#!/usr/bin/env node
/**
 * Post-deploy smoke: hits /api/health on your deployed URL.
 *
 * Usage:
 *   BASE_URL=https://stackpilot-app.vercel.app node scripts/smoke-check.mjs
 *
 * Local (with dev server running):
 *   node scripts/smoke-check.mjs
 */

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const url = `${base}/api/health`

async function main() {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    console.error(`FAIL: Non-JSON from ${url}\n${text.slice(0, 500)}`)
    process.exit(1)
  }

  console.log(JSON.stringify(json, null, 2))

  if (!json.ok) {
    console.error('\nFAIL: health.ok is false (see checks above)')
    process.exit(1)
  }

  if (!res.ok) {
    console.error(`\nFAIL: HTTP ${res.status}`)
    process.exit(1)
  }

  console.log('\nOK: smoke check passed')
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
