# StackPilot release checklist

Use this before calling the dashboard “production ready.” Automate what you can; sign off the rest manually.

## Automated (run locally or in CI)

| Step | Command | Pass criteria |
|------|---------|----------------|
| Lint | `npm run lint` | Exit 0 |
| Typecheck | `npm run typecheck` | Exit 0 |
| Production build | `npm run build` | Exit 0 |
| Smoke (needs running server or deployed URL) | `BASE_URL=https://your-domain.vercel.app node scripts/smoke-check.mjs` | JSON `ok: true`, HTTP 200 |

CI runs lint + typecheck + build on push/PR to `main` / `master`.

## Production `/api/health`

- **GET** `/api/health` — DB ping + env presence flags (no secrets returned).
- Expect **HTTP 200** and `"ok": true` when `DATABASE_URL`, DB reachable, and `NEXTAUTH_SECRET` are set.
- Expect **HTTP 503** if critical checks fail (monitoring should alert).

## Manual — must sign off on production

These require a real browser session and/or seller account.

| # | Flow | Pass criteria |
|---|------|----------------|
| 1 | Login / logout | Session persists across refresh; logout clears session |
| 2 | eBay connect | OAuth completes; dashboard shows connected |
| 3 | Orders | Sync loads orders; desktop + mobile/PWA usable |
| 4 | Single listing | Publish succeeds; duplicate ASIN rejected |
| 5 | Trial limit | At limit, API returns trial error as configured |
| 6 | Financials / Performance | Tabs load without error for connected account |
| 7 | Fulfillment | Start flow returns usable fulfill URL / token |
| 8 | Crons | Vercel shows scheduled runs; responses not 401 for scheduled jobs |
| 9 | Auto Bulk Listing (if enabled) | Settings enable → queue activity / listings as expected; pause/stop works |
| 10 | Admin `/admin` | Only intended admins can access |

## Environment (Vercel Production)

Confirm variables exist (names only — values in Vercel UI):

- `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `EBAY_APP_ID`, `EBAY_CERT_ID`, `EBAY_RUNAME` (+ dev id if used)
- `CRON_SECRET` (recommended)
- Optional: `RAPIDAPI_KEY`, `OPENROUTER_API_KEY`, etc.

## What we cannot automate here

- eBay / Amazon API behavior under your specific seller limits
- Real-device PWA install and safe-area quirks
- Legal/compliance and account-restriction outcomes

Document incidents and update this file when processes change.
