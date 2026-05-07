# StackPilot — Agent Collaboration Log

This file is shared between **Claude**, **Codex**, **Cursor**, and **Antigravity**.
Read it before starting any work. Update it when you finish.

## Agent Workflow

1. Read `COLLAB.md` before starting work.
2. Keep edits scoped and avoid overwriting another agent's active files.
3. Update `COLLAB.md` after finishing important changes, deploys, or blockers.

---

## 🔴 Currently In Progress
_Clear this section when done._

| Agent | File(s) | What | Started |
|-------|---------|------|---------|
| — | — | — | — |

---

## ✅ Recently Completed

| Date | Agent | What Was Done | Key Files |
|------|-------|---------------|-----------|
| 2026-05-08 | GPT-5.2 | Fulfillment tab: in-tab Amazon extension setup card; fulfill URLs carry `stackpilotOrigin` for the extension API; broader extension host permissions | `app/dashboard/components/FulfillmentTab.tsx`, `app/api/fulfillment/start/route.ts`, `extension/manifest.json`, `extension/background.js`, `extension/INSTALL.md` |
| 2026-05-08 | GPT-5.2 | Host extension zip on StackPilot (`/stackpilot-fulfillment-extension.zip` via `prebuild`/`dev`); Fulfillment tab primary download button — no GitHub required | `scripts/zip-extension.mjs`, `package.json`, `app/dashboard/components/FulfillmentTab.tsx`, `.gitignore`, `extension/INSTALL.md` |
| 2026-05-08 | GPT-5.2 | Extension v0.2: persist ship-to in chrome.storage, try **Buy Now** on PDP, fill Amazon checkout widget IDs + retries; skip sign-in autofill | `extension/manifest.json`, `extension/background.js`, `extension/content.js`, `extension/INSTALL.md` |
| 2026-05-07 | Cursor/GPT | **Fulfillment (shipped):** Fulfillment **Queue** tab (awaiting shipment, ship-to copy, mapped ASIN); `lib/fulfillment` + `/api/fulfillment/{start,payload,status}`; Fulfill token URLs + optional-extension card + zip (`prebuild`/`dev`); **idempotent** payload (`getFulfillmentPayloadByToken`); fulfill URL **query + hash**; ship_to **normalize + flatten**; MV3 extension through **v0.3.2** — scaffold → `content-bootstrap.js` @ document_start, Buy Now + checkout + iframes, **Add new delivery address** priority, `clickAmazonControl`, service worker logging | `lib/fulfillment.ts`, `app/api/fulfillment/*`, `app/dashboard/types.ts`, `app/dashboard/constants.ts`, `app/dashboard/api.ts`, `app/dashboard/components/FulfillmentTab.tsx`, `app/dashboard/page.tsx`, `extension/*`, `scripts/zip-extension.mjs`, `package.json` |
| 2026-05-06 | Codex | Finished remaining launch polish queued in COLLAB (removed last generic `29223` publish fallback; added personalized first-name greeting on Overview) | `app/api/ebay/list-product/route.ts`, `app/dashboard/components/OverviewTab.tsx`, `app/dashboard/page.tsx` |
| 2026-05-06 | Codex | Added StackPilot PWA support — web manifest, standalone metadata, icons, service worker shell cache | `app/layout.tsx`, `app/manifest.ts`, `app/pwa-registration.tsx`, `app/globals.css`, `public/stackpilot-icon-192.png`, `public/stackpilot-icon-512.png`, `public/apple-touch-icon.png`, `public/sw.js` |
| 2026-05-06 | Codex | Added Problem Listings visibility to `/admin` with low-image/category warnings, issue tags, per-listing details | `app/admin/page.tsx`, `app/api/admin/stats/route.ts`, `app/globals.css` |
| 2026-05-06 | Codex | Added admin "Fix All" / repair-listings endpoint to backfill low-image records, recover missing categories | `app/admin/page.tsx`, `app/api/admin/repair-listings/route.ts`, `app/globals.css` |
| 2026-05-06 | Codex | Expanded `/admin` into full StackPilot control center (launch warnings, listing quality, pool/queue readiness, COLLAB viewer) | `app/admin/page.tsx`, `app/api/admin/stats/route.ts`, `app/globals.css` |
| 2026-05-06 | Codex | Polished private beta signup/request-access flow and premium public homepage copy/layout | `app/signup/page.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css` |
| 2026-05-06 | Codex | Added live queue rotation for Product Listing / Continuous Listing: 60-product pool, show 30, reshuffle every second | `app/dashboard/page.tsx`, `app/dashboard/components/ProductListingTab.tsx` |
| 2026-05-06 | Codex | Refined StackPilot homepage (cleaner hero, removed distracting copy, airplane animation) | `app/page.tsx`, `app/globals.css`, `public/stackpilot-plane.svg` |
| 2026-05-06 | Codex | Added bulk listing preflight + replacement: skips weak titles/bad prices/low-profit/<2-image items before eBay publish | `app/dashboard/utils.ts`, `app/dashboard/page.tsx`, `app/dashboard/components/ProductListingTab.tsx`, `app/api/scripts/run/route.ts` |
| 2026-05-06 | Codex | Added CI checks (lint + typecheck), `.env.example`, normalized `/api/ai` with `OPENROUTER_*` env support | `.env.example`, `app/api/ai/route.ts`, `package.json`, `.eslintrc.json`, `.github/workflows/ci.yml` |
| 2026-05-06 | Antigravity | Fixed all NICHE_FALLBACK_LEAF_CATEGORY `29223` catch-alls — replaced with real eBay leaf category IDs (Clothing→11450, Jewelry→281, Coins→11116, Medical→51148, Car Parts→6030, Sporting→15273, Fishing→1492, Garden→2032, Safety→177742, Vintage→20081, Industrial→12576, Cleaning/Janitorial/Packaging→26677, Motorcycle→10063, Car Care→179716, Mental Wellness→26395, Fitness→15273) | `app/api/ebay/list-product/route.ts` |
| 2026-05-06 | Antigravity | Added personalized greeting to Overview tab — `"Good morning, Mike 👋"` via `userName` prop using `session.user.name` split on first space | `app/dashboard/components/OverviewTab.tsx`, `app/dashboard/page.tsx` |
| 2026-05-06 | Antigravity | Confirmed Performance tab already parallelized — `fetchOrders`, DB query, `fetchActiveListingMetrics` in `Promise.all`. No change needed. | `app/api/performance/route.ts` |
| 2026-05-06 | Antigravity | Updated COLLAB.md — added Cursor + Antigravity to agent roster, resolved merge conflict | `COLLAB.md` |
| 2026-05-06 | GPT-5.2 | Made `/admin` COLLAB viewer always live (no-store; force-dynamic) and confirmed `COLLAB.md` is the single canonical collaboration file | `app/api/admin/collab/route.ts`, `app/admin/page.tsx`, `COLLAB.md` |
| 2026-05-03 | Claude | Trusted mode title + price accuracy: after ASIN mismatch check, `validatedAmazon.title` replaced with `amazon_product_cache` title; price updated from cache if drift >10% | `app/api/ebay/list-product/route.ts` |
| 2026-05-03 | Claude | ASIN mismatch guard now universal — runs for ALL trusted listings regardless of image count | `app/api/ebay/list-product/route.ts` |
| 2026-05-03 | Claude | Campaigns Boost All fixed: correct eBay `bulk_create_ads_by_listing_id` body format | `app/api/ebay/campaigns/[campaignId]/listings/route.ts` |
| 2026-05-03 | Claude | Campaigns tab fixes: creation payload, empty/204 response, scope additions (`sell.marketing`), reconnect banner | `app/api/ebay/campaigns/route.ts`, `lib/ebay-auth.ts`, `app/dashboard/components/CampaignsTab.tsx` |
| 2026-05-03 | Claude | Loss-making listing block: catches both overpricing (>1.4× median) and underpricing (<0.62× median) | `app/api/ebay/list-product/route.ts` |
| 2026-05-02 | Claude | Image contamination fix + title punctuation + ASIN mismatch guard (non-trusted) | `lib/amazon-product.ts`, `app/api/ebay/list-product/route.ts` |
| 2026-05-02 | Claude | Title truncation strips trailing connectors/punctuation; trusted bulk >$40 runs live competitor check | `app/api/ebay/list-product/route.ts` |
| 2026-05-02 | Claude | Daily cron fixed: `vercel.json` changed to `?catalog=1&wait=1` — now runs full scraping (was no-op) | `vercel.json`, `app/api/cron/refresh-products/route.ts` |
| 2026-05-01 | Claude | 6-fix bulk listing pass: pricing, duplicate block, scraper fallback, warm cache, background enrichment, continuous concurrency | `app/api/ebay/list-product/route.ts`, `lib/product-source-engine.ts`, `lib/amazon-product.ts`, `app/api/cron/refresh-products/route.ts`, `app/api/scripts/product-finder/route.ts`, `app/dashboard/page.tsx` |
| 2026-05-01 | Claude | Amazon unavailability sync: block at listing + pool cleanup + auto-end listings daily | `app/api/ebay/list-product/route.ts`, `lib/product-source-engine.ts`, `app/api/cron/refresh-products/route.ts` |
| 2026-05-01 | Claude | Fix bulk listing: cache supplement in product-finder + list-product, block sparse fallback listings, concurrency 5→3 | `lib/amazon-product.ts`, `app/api/scripts/product-finder/route.ts`, `app/api/ebay/list-product/route.ts`, `app/dashboard/page.tsx` |
| 2026-05-01 | Claude | Fix wrong gallery images: removed `fetchedAmazon.images` from gallery entirely | `app/api/ebay/list-product/route.ts` |
| 2026-05-01 | Claude | Re-validate at publish for sparse images (<2): skip trusted mode, do full Amazon re-validation | `app/dashboard/page.tsx` |
| 2026-05-01 | Claude | Fix niche cursor: `Number('')` was 0; now uses `hasExplicitStart` flag | `app/api/cron/refresh-products/route.ts` |
| 2026-05-01 | Claude | Unblock supplements: only controlled substances remain blocked | `lib/listing-policy.ts` |
| 2026-05-01 | Claude | Cross-user ASIN dedup: product finder loads ALL users' active ASINs (limit 2,000) | `app/api/scripts/product-finder/route.ts` |
| 2026-05-01 | Claude | Niche rotation fix: catalog crawl picks 3 stalest niches by oldest `cached_at` | `app/api/cron/refresh-products/route.ts` |
| 2026-04-29 | Claude | BIG: own scraper replaces RapidAPI — `scrapeAmazonSearch`, 20 queries × 5 pages × 20 products = 2,500/niche | `app/api/cron/refresh-products/route.ts`, `app/api/admin/refresh-pool/route.ts`, `app/admin/page.tsx` |
| 2026-04-29 | Claude | Parallel scraping: 5 simultaneous scrape calls per niche, ~5x throughput | `app/api/cron/refresh-products/route.ts`, `vercel.json` |
| 2026-04-29 | Claude | SEO title expander, listing policy guard, smart feature bullets, stale pricing fix, fast bulk listing | `app/api/ebay/list-product/route.ts`, `lib/listing-policy.ts`, `lib/product-source-engine.ts` |
| 2026-04-30 | Codex | Rebuilt pricing into shared dynamic engine — cost-band ROI targets, psychological endings, competitor-aware publish | `lib/listing-pricing.ts`, all pricing consumers |
| 2026-04-30 | Codex | Fixed stale product-cache pricing, listing polish (badge, description), removed hard `PRICING_NOT_VIABLE` block | `app/api/scripts/product-finder/route.ts`, `app/api/ebay/list-product/route.ts`, `public/free-shipping-stamp.png` |
| 2026-04-29 | Codex | Added Product Source Health in Settings, source-engine, cache warm, cron integration | `app/api/product-source/health/route.ts`, `lib/product-source-engine.ts`, multiple |
| 2026-04-29 | Codex | Fixed Continuous Listing cold starts, 504 risk, product rotation, and dashboard theme | `app/api/scripts/product-finder/route.ts`, `app/dashboard/page.tsx`, `app/globals.css` |
| 2026-04-28 | Claude | Rebrand EbayDash → StackPilot; all tabs redesigned; emojis in sidebar; FedEx2Day shipping; eBay Taxonomy API | All tab components, `app/api/ebay/list-product/route.ts` |

---

## ⚠️ Flags for Other Agent

- **Amazon connection**: REMOVED from Settings UI and page.tsx bootstrap. Do NOT add back — it doesn't work.
- **Agent roles**:
  - **Codex** = primary coder; `stackpilot-app.vercel.app` always points to Codex's latest deployment.
  - **Claude** = works in local Desktop copy, documents changes here for Codex to merge.
  - **Cursor** = active on this project; reads/writes COLLAB.md as source of truth.
  - **Antigravity** = active on this project; reads/writes COLLAB.md as source of truth.
  - All agents: read COLLAB.md before starting, update it when done.
- **NICHE_FALLBACK_LEAF_CATEGORY**: ✅ FIXED (2026-05-06) — all `29223` catch-alls replaced with real eBay leaf IDs. Do not revert.
- **Performance tab parallelization**: ✅ DONE — already runs in `Promise.all`. No action needed.
- **Overview greeting**: ✅ DONE (2026-05-06) — `"Good morning, [FirstName] 👋"` via `userName` prop in OverviewTab.
- **Category system**: Taxonomy REST API → ASIN Browse API → Legacy Trading API → NICHE_FALLBACK_LEAF_CATEGORY. Do NOT revert to `GetSuggestedCategories` as primary.
- **Shipping**: Default is `FedEx2Day` + `ExpeditedService: true`. Do NOT change back to USPSPriority.
- **Image pipeline**: Only `validatedAmazon.images` + provided `imageUrl` used in gallery. `fetchedAmazon.images` NEVER used for gallery — causes image contamination. Do not revert.
- **Free shipping stamp**: `public/free-shipping-stamp.png` was replaced — do not overwrite.
- **Brand name**: All UI is `StackPilot`. Vercel project = `stackpilot-app`. URL = `stackpilot-app.vercel.app`.
- **`NEXTAUTH_URL`** in Vercel = `https://stackpilot-app.vercel.app` — matches eBay Dev Console.
- **Product Finder distribution**: Per-user seeded ranking, large shared pool, performance signals. Do not revert.
- **Fee rates**: `lib/listing-pricing.ts` is the shared engine — use it everywhere. `constants.ts` = 13.25% (display only). `listing-pricing.ts` = 15% actual. Do not introduce separate fee math.
- **Trusted mode**: Used for List All — skips Amazon re-validation. Uses cached `amazonPrice`. Do NOT disable — it's 3× faster for bulk listing.
- **Trusted mode pricing (2026-05-01)**: Always uses `pricingRecommendation.price` (fresh engine calc), not stale cached `ebayPrice`. Do NOT revert.
- **Trusted mode title/price accuracy (2026-05-03)**: After ASIN mismatch check, title = `cached.title`, price updated from cache if drift >10%. Do NOT revert.
- **ASIN mismatch guard — trusted mode (2026-05-03)**: Unconditional. Fires before supplement. 45% word overlap. Do NOT move inside `isDataSparse`.
- **ASIN mismatch guard — non-trusted (2026-05-02)**: <25% word overlap → `ASIN_MISMATCH`, listing blocked. Do NOT remove.
- **PRICE_BELOW_MARKET block (2026-05-03)**: `finalEbayPrice < competitor_median × 0.62` AND ≥3 data points → blocked. Do NOT raise the 0.62 threshold.
- **Duplicate listing block (2026-05-01)**: Checks `listed_asins` before calling eBay. Returns `ALREADY_LISTED (409)`. Do NOT remove — prevents eBay violations.
- **Unavailability sync (2026-05-01)**: Products confirmed unavailable auto-ended daily. Block at listing time. Do NOT revert.
- **fallbackImage (2026-05-02)**: Only used when source returned zero real images. NEVER appended unconditionally. Do NOT revert.
- **Bulk listing preflight (2026-05-06)**: `getBulkPreflightIssue` skips weak titles, bad prices, <2 images, low profit before eBay publish. Do NOT remove.
- **Live queue rotation (2026-05-06)**: 60-product pool, display 30, reshuffle client-side every second. Pauses during modal/bulk. Do NOT change to server-side 1s refresh.
- **Bulk concurrency**: `listProductsInBatches` called with `concurrency: 3`. Do NOT raise to 5 — causes Amazon rate limiting.
- **Background enrichment (2026-05-01)**: Up to 12 sparse products enriched via `after()` post-response. Do NOT await — defeats the purpose.
- **Daily cron (2026-05-02)**: `vercel.json` uses `?catalog=1&wait=1`. Do NOT revert to `?catalog=1` without `&wait=1` — that was a no-op for product discovery.
- **Supplements niche**: Can be listed EXCEPT controlled substances (kratom, ozempic, insulin, testosterone, CBD/THC, nicotine).
- **Cross-user dedup**: Product finder loads ALL active ASINs across all users (limit 2,000). Intentional. Do NOT revert to per-user only.
- **Campaigns tab**: Requires `sell.marketing` scope. Existing users must disconnect + reconnect eBay once. Yellow banner guides them.
- **Vercel deploy alias**: Verify `stackpilot-app.vercel.app` points to latest deploy after each push.
- **CI**: Runs `npm ci`, `npm run lint`, `npm run typecheck` on PRs and pushes to `main/master`.
- **AI route**: Requires `OPENROUTER_API_KEY`. Prompt length cap: 2400 chars. Model via `OPENROUTER_MODEL`.

---

## 📋 Queued Tasks from Mike

| Priority | Task | Notes |
|----------|------|-------|
| — | All queued tasks completed | See Recently Completed above |

---

## 📌 Architecture Notes

- **Category selection chain**: Taxonomy REST API → ASIN Browse API → Legacy Trading API → NICHE_FALLBACK_LEAF_CATEGORY → `29223` (last resort)
- **Image chain**: `validatedAmazon.images` + `imageUrl` merged → deduplicated → badge stamped on first image → EPS upload
- **Shipping**: FedEx2Day, ExpeditedService=true, FreeShipping=true, DispatchTimeMax=0
- **Pricing**: `lib/listing-pricing.ts` — dynamic cost-band ROI targets, eBay variable + fixed fee + buffer, psychological endings, competitor-aware final price
- **Niche cursor**: Stored in `product_cache` as `niche = '__cursor__'`. Advances 3 per catalog crawl. All 40 niches rotate every ~14 days.
- **Scraper**: `scrapeAmazonSearch` in `lib/amazon-scrape.ts` hits amazon.com directly. RapidAPI is fallback only. 20 queries × 5 pages × 20 products = 2,500/niche.
- **Amazon badges stripped**: `sanitizeContent()` + `cleanTitle` strip Amazon Choice, Overall Pick, Best Seller, etc.
