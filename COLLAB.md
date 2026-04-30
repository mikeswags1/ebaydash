# StackPilot — Agent Collaboration Log

This file is shared between **Claude** and **Codex**.
Read it before starting any work. Update it when you finish.

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
| 2026-04-30 | Codex | Removed the hard `PRICING_NOT_VIABLE` publish block so below-market comps become a stored pricing warning/floor instead of stopping Product Listing; cleaned old USPS fallback copy | `app/api/ebay/list-product/route.ts` |
| 2026-04-30 | Codex | Fixed listing polish: regenerated transparent free-shipping PNG, made listing badge larger/trimmed, and restored detailed eBay descriptions from source description, feature bullets, and specs | `public/free-shipping-stamp.png`, `app/api/image/badge/route.ts`, `app/api/ebay/list-product/route.ts` |
| 2026-04-30 | Codex | Fixed stale product-cache pricing so Product Finder/Continuous Listing reprices cached rows on read/save, source-engine rows recalculate on read, and cache version bumped to flush old ROI values | `app/api/scripts/product-finder/route.ts`, `app/api/cron/refresh-products/route.ts`, `lib/product-source-engine.ts` |
| 2026-04-30 | Codex | Rebuilt pricing into a shared dynamic engine with cost-band ROI targets, eBay fee/fixed-fee/buffer math, psychological endings, competitor-aware publish pricing, and unified dashboard/source/cron/finder calculations | `lib/listing-pricing.ts`, `app/api/ebay/list-product/route.ts`, `app/api/cron/refresh-products/route.ts`, `app/api/scripts/product-finder/route.ts`, `lib/product-source-engine.ts`, `app/dashboard/utils.ts`, `app/dashboard/constants.ts` |
| 2026-04-30 | Codex | Added shared listing policy guard for Product Finder, Continuous Listing, source-engine intake, and final eBay publish; added deep catalog refresh mode for larger product-source warmups | `lib/listing-policy.ts`, `app/api/scripts/product-finder/route.ts`, `app/api/cron/refresh-products/route.ts`, `lib/product-source-engine.ts`, `app/api/ebay/list-product/route.ts` |
| 2026-04-29 | Claude | Removed Amazon Seller connection card from Settings + removed `fetchAmazonCredentials` from bootstrap + removed "Unable to load Amazon connection status" banner | `SettingsTab.tsx`, `page.tsx` |
| 2026-04-29 | Codex | Added Product Source Health visibility in Settings so source-engine depth, niche cache readiness, Continuous Listing stock, warnings, and top source niches are visible from the dashboard | `app/api/product-source/health/route.ts`, `app/dashboard/components/SettingsTab.tsx`, `app/dashboard/page.tsx`, `app/dashboard/api.ts`, `app/dashboard/types.ts` |
| 2026-04-29 | Codex | Added the first StackPilot-owned Product Source Engine: scored product-source table, cache seeding, Product Finder fast path, and cron/setup integration | `lib/product-source-engine.ts`, `app/api/scripts/product-finder/route.ts`, `app/api/cron/refresh-products/route.ts`, `app/api/setup-db/route.ts` |
| 2026-04-29 | Codex | Warmed the live Continuous Listing cache to 160 products and added automatic continuous-cache rebuilds to the product refresh cron so RapidAPI 429s do not leave the queue empty | `app/api/cron/refresh-products/route.ts` |
| 2026-04-29 | Codex | Removed Product Finder browser aborts and hot-path DB/schema/cache delays so Continuous Listing can return instead of timing out; added product-finder runtime count/duration logs | `app/api/scripts/product-finder/route.ts`, `app/dashboard/api.ts` |
| 2026-04-29 | Codex | Fixed Product Listing and Continuous Listing queue stocking with broader niche queries, strict-plus-backup product sourcing, tighter continuous cache rules, and safer request timeouts | `app/api/scripts/product-finder/route.ts`, `app/dashboard/api.ts`, `lib/amazon-scrape.ts` |
| 2026-04-29 | Codex | Made Continuous Listing cold starts fast with parallel capped product searches, added client timeout protection, and kept cron deploy-safe on Vercel Hobby while supporting rolling refresh mode | `app/api/scripts/product-finder/route.ts`, `app/dashboard/api.ts`, `app/api/cron/refresh-products/route.ts`, `vercel.json` |
| 2026-04-29 | Codex | Fixed Continuous Listing 504 risk with cache-first fast queue refreshes, kept existing products visible while shuffling, and made the dashboard theme calmer/readable | `app/api/scripts/product-finder/route.ts`, `app/dashboard/page.tsx`, `app/dashboard/components/*`, `app/globals.css` |
| 2026-04-29 | Codex | Fixed StackPilot Vercel alias/protection check, reduced Continuous Listing timeout risk, and softened dashboard UI into a friendlier tropical/sky theme | `app/api/scripts/product-finder/route.ts`, `app/dashboard/page.tsx`, dashboard components, `app/globals.css` |
| 2026-04-28 | Codex | Improve Product Finder/Continuous Listing distribution with per-user randomized ranking, larger Amazon pools, active-listing duplicate filtering, and performance-weighted continuous sourcing | `app/api/scripts/product-finder/route.ts` |
| 2026-04-28 | Claude | Rebrand EbayDash → StackPilot, URL renamed to stackpilot-app.vercel.app | `app/layout.tsx`, `app/page.tsx`, all tab components, `DashboardSidebar.tsx` |
| 2026-04-28 | Claude | Replace free shipping stamp with new FREE 2-4 DAY SHIPPING label | `public/free-shipping-stamp.png` |
| 2026-04-28 | Claude | Replace GetSuggestedCategories with eBay Taxonomy REST API for accurate categories | `app/api/ebay/list-product/route.ts` |
| 2026-04-28 | Claude | Add ASIN-based category lookup via eBay Browse API | `app/api/ebay/list-product/route.ts` |
| 2026-04-28 | Claude | Fix single-image bug — merge scraper + API images, fix all niche fallback categories | `app/api/ebay/list-product/route.ts` |
| 2026-04-28 | Claude | Strip Amazon badges from titles/descriptions (Amazon Choice, Overall Pick, etc.) | `app/api/ebay/list-product/route.ts` |
| 2026-04-28 | Claude | Switch shipping to FedEx2Day + ExpeditedService=true for green delivery label | `app/api/ebay/list-product/route.ts` |
| 2026-04-28 | Claude | Add emojis to sidebar nav tabs | `app/dashboard/constants.ts`, `DashboardSidebar.tsx` |
| 2026-04-28 | Claude | Redesign all dashboard tabs (Overview, Orders, Financials, Performance, ASIN, Product Listing) | All tab components |

---

## ⚠️ Flags for Other Agent

- **Amazon connection**: REMOVED from Settings UI and page.tsx bootstrap. Do NOT add back — it doesn't work.
- **Codex = primary coder**: `stackpilot-app.vercel.app` always points to Codex's latest deployment. Claude works in a separate Desktop copy and documents changes here for Codex to merge.
- **Category system**: Now uses eBay Taxonomy REST API (`/commerce/taxonomy/v1/...`) as primary source. Do NOT revert to `GetSuggestedCategories` as primary — it is kept only as a legacy fallback.
- **NICHE_FALLBACK_LEAF_CATEGORY**: All `29223` catch-alls should be replaced with real eBay category IDs. Claude fixed this in Desktop copy — Codex should apply same fix: Coins→11116, Clothing→11450, Jewelry→281, Fishing→1492, Sporting→15273, Medical→51148, Garden→2032, Safety→177742, Vintage→20081, Industrial→12576, Car Parts→6030, Cleaning/Packaging/Janitorial→26677, Fitness/Sporting→15273.
- **Shipping**: Default is `FedEx2Day` + `ExpeditedService: true`. Do NOT change back to USPSPriority.
- **Image pipeline**: `fetchedAmazon.images` merged into `validatedGallery` — bug fix, do not remove.
- **Free shipping stamp**: `public/free-shipping-stamp.png` was replaced — do not overwrite.
- **Brand name**: All UI is `StackPilot`. Vercel project = `stackpilot-app`. URL = `stackpilot-app.vercel.app`.
- **`NEXTAUTH_URL`** in Vercel = `https://stackpilot-app.vercel.app` — matches eBay Dev Console.
- **Product Finder distribution**: Per-user seeded ranking, large shared pool, performance signals. Do not revert.
- **Fee rates/pricing**: Use the shared `lib/listing-pricing.ts` engine everywhere. Do not reintroduce separate dashboard/source/listing fee math.
- **Performance tab**: Consider parallelizing — `fetchOrders`, DB query, and `fetchActiveListingMetrics` can all run in `Promise.all`. Traffic chunks can also be parallel. Orders can be date-filtered to last 90 days. This cuts load time roughly in half.
- **Overview greeting**: Mike wants "Good morning, [FirstName] 👋" using `session.user.name` split on space. Pass as `userName` prop to OverviewTab.

---

## 🏁 Project Status — Final Stretch

Dashboard is functionally complete. Core flows confirmed working:
- eBay OAuth connected, orders syncing
- Continuous Listing queue stocked (160 products, version 5)
- Product Source Health visible in Settings
- Performance tab parallelized — fast load
- Amazon connection fully removed
- Mobile layout responsive via `--xpad` CSS variable
- `stackpilot-app.vercel.app` is canonical URL

**Remaining before ship:** Scripts tab cleanup (Mike is reviewing), category fallback fix (see flags), personalized greeting on Overview.

## 📋 Queued Tasks from Mike

| Priority | Task | Notes |
|----------|------|-------|
| 🔴 HIGH | Scripts tab — Mike is reviewing what to change | Awaiting direction |
| 🔴 HIGH | Fix NICHE_FALLBACK_LEAF_CATEGORY in `list-product/route.ts` | All `29223` fallbacks need real IDs — see flags for full mapping |
| 🟡 MED | Add personalized greeting to Overview tab | "Good morning, Mike 👋" using `session.user.name` split on space, passed as `userName` prop |

---

## 📌 Architecture Notes

- **Category selection chain**: Taxonomy REST API → ASIN Browse API → Legacy Trading API → NICHE_FALLBACK_LEAF_CATEGORY → `29223`
- **Image chain**: `validatedAmazon.images` + `fetchedAmazon.images` + `imageUrl` merged → deduplicated → badge stamped on first image → EPS upload
- **Shipping**: FedEx2Day, ExpeditedService=true, FreeShipping=true, DispatchTimeMax=0
- **Pricing**: `lib/listing-pricing.ts` — dynamic cost-band ROI targets, eBay variable fee + fixed fee + operating buffer, psychological endings, and competitor-aware final publish price.
- **Fee rate source**: `constants.ts`, finder, cron, source engine, and final eBay publish all import the shared pricing engine. Keep them aligned.
- **Amazon badges stripped**: `sanitizeContent()` + title `cleanTitle` both strip Amazon Choice, Overall Pick, Best Seller, etc.
