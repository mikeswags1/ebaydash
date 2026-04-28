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

- **Category system**: Now uses eBay Taxonomy REST API (`/commerce/taxonomy/v1/...`) as primary source. Do NOT revert to `GetSuggestedCategories` as primary — it is kept only as a legacy fallback.
- **Shipping**: Default service is `FedEx2Day` with `ExpeditedService: true`. Do NOT change back to USPSPriority as default.
- **Image pipeline**: `fetchedAmazon.images` (scraper) is merged into `validatedGallery` — this was a bug fix, do not remove.
- **Free shipping stamp**: `public/free-shipping-stamp.png` was replaced with new design — do not overwrite.
- **Brand name**: All UI references are now `StackPilot`. Vercel project is `stackpilot-app`, URL is `stackpilot-app.vercel.app`.
- **`NEXTAUTH_URL`** in Vercel is set to `https://stackpilot-app.vercel.app` — matches eBay Dev Console.

---

## 📋 Queued Tasks from Mike
_Add tasks here when Mike requests something that neither agent has started yet._

| Priority | Task | Notes |
|----------|------|-------|
| — | — | — |

---

## 📌 Architecture Notes

- **Category selection chain**: Taxonomy REST API → ASIN Browse API → Legacy Trading API → NICHE_FALLBACK_LEAF_CATEGORY → `29223`
- **Image chain**: `validatedAmazon.images` + `fetchedAmazon.images` + `imageUrl` merged → deduplicated → badge stamped on first image → EPS upload
- **Shipping**: FedEx2Day, ExpeditedService=true, FreeShipping=true, DispatchTimeMax=0
- **Pricing**: `lib/listing-pricing.ts` — tiered profit targets, 15% fee rate, `.99` rounding
- **Fee rate discrepancy**: `constants.ts` uses 13.25% (display only), `listing-pricing.ts` uses 15% (actual calculation). Align before changing either.
- **Amazon badges stripped**: `sanitizeContent()` + title `cleanTitle` both strip Amazon Choice, Overall Pick, Best Seller, etc.
