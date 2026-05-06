import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { queryRows, sql } from '@/lib/db'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { ensureListedAsinsFinancialColumns } from '@/lib/listed-asins'
import { fetchAmazonProductByAsin } from '@/lib/amazon-product'

const ADMIN_EMAILS = ['msawaged12@gmail.com', 'mikeswags1@gmail.com']

export const maxDuration = 300

const NICHE_FALLBACK_LEAF_CATEGORY: Record<string, string> = {
  'Phone Accessories': '9394',
  'Computer Parts': '58058',
  'Audio & Headphones': '14985',
  'Smart Home Devices': '183406',
  'Gaming Gear': '139971',
  'Kitchen Gadgets': '20625',
  'Home Decor': '10033',
  'Furniture & Lighting': '95672',
  'Cleaning Supplies': '26677',
  'Storage & Organization': '26677',
  'Camping & Hiking': '16034',
  'Garden & Tools': '2032',
  'Sporting Goods': '15273',
  'Fishing & Hunting': '1492',
  'Cycling': '2904',
  'Fitness Equipment': '15273',
  'Personal Care': '26248',
  'Supplements & Vitamins': '180960',
  'Medical Supplies': '51148',
  'Mental Wellness': '26395',
  'Car Parts': '6030',
  'Car Accessories': '14946',
  'Motorcycle Gear': '10063',
  'Truck & Towing': '6030',
  'Car Care': '179716',
  'Pet Supplies': '1281',
  'Baby & Kids': '2984',
  'Toys & Games': '19169',
  'Clothing & Accessories': '11450',
  'Jewelry & Watches': '281',
  'Office Supplies': '26215',
  'Industrial Equipment': '12576',
  'Safety Gear': '177742',
  'Janitorial & Cleaning': '26677',
  'Packaging Materials': '26677',
  'Trading Cards': '183050',
  'Vintage & Antiques': '20081',
  'Coins & Currency': '11116',
  'Comics & Manga': '259104',
  'Sports Memorabilia': '64482',
}

type RepairRow = {
  id: number
  asin: string | null
  title: string | null
  amazon_price: string | number | null
  amazon_image_url: string | null
}

type UserRepairRow = {
  user_id: number
}

type CategoryRepairRow = {
  id: number
  niche: string | null
  title: string | null
}

type EbayListingMeta = {
  listingId: string
  title: string
  categoryId: string
  categoryName: string
  pictures: string[]
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match?.[1] ? decodeXml(match[1].trim()) : ''
}

function tags(block: string, name: string) {
  return [...block.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'gi'))]
    .map((match) => decodeXml(String(match[1] || '').trim()))
    .filter((value) => value.startsWith('http'))
}

function normalizeNiche(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (NICHE_FALLBACK_LEAF_CATEGORY[raw]) return raw

  const lower = raw.toLowerCase()
  return Object.keys(NICHE_FALLBACK_LEAF_CATEGORY).find((niche) => niche.toLowerCase() === lower) || ''
}

function inferFallbackCategoryId(row: CategoryRepairRow) {
  const niche = normalizeNiche(row.niche)
  if (niche) return NICHE_FALLBACK_LEAF_CATEGORY[niche]

  const title = String(row.title || '').toLowerCase()
  if (/(iphone|samsung|galaxy|phone case|screen protector|charger|magsafe)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Phone Accessories']
  if (/(keyboard|mouse|usb|laptop|computer|monitor)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Computer Parts']
  if (/(headphone|earbud|speaker|microphone)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Audio & Headphones']
  if (/(paper towel|cleaning|janitorial|trash bag|soap|mop)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Janitorial & Cleaning']
  if (/(organizer|storage|divider|bin|shelf)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Storage & Organization']
  if (/(dog|cat|pet|leash|harness)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Pet Supplies']
  if (/(lamp|light|chair|table|furniture)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Furniture & Lighting']
  if (/(garden|plant|tool|glove)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Garden & Tools']
  if (/(shirt|socks|wallet|hat|clothing)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Clothing & Accessories']
  if (/(auto|car|vehicle|obd|dash cam)/.test(title)) return NICHE_FALLBACK_LEAF_CATEGORY['Car Accessories']
  return ''
}

async function repairImagesFromAmazonCache() {
  const rows = await queryRows<{ id: number }>`
    UPDATE listed_asins la
    SET
      amazon_images = apc.images,
      amazon_image_url = COALESCE(apc.primary_image, apc.images->>0, la.amazon_image_url),
      amazon_snapshot = COALESCE(la.amazon_snapshot, '{}'::jsonb) || jsonb_build_object(
        'images', apc.images,
        'imageUrl', COALESCE(apc.primary_image, apc.images->>0),
        'repairSource', 'amazon_product_cache',
        'repairedAt', NOW()
      )
    FROM amazon_product_cache apc
    WHERE UPPER(apc.asin) = UPPER(la.asin)
      AND la.ended_at IS NULL
      AND (
        CASE
          WHEN la.amazon_images IS NOT NULL AND jsonb_typeof(la.amazon_images) = 'array'
          THEN jsonb_array_length(la.amazon_images)
          ELSE 0
        END
      ) < 2
      AND jsonb_typeof(apc.images) = 'array'
      AND jsonb_array_length(apc.images) >= 2
    RETURNING la.id
  `.catch(() => [])

  return rows.length
}

async function repairImagesFromAmazonLookup() {
  const candidates = await queryRows<RepairRow>`
    SELECT id, asin, title, amazon_price, amazon_image_url
    FROM listed_asins
    WHERE ended_at IS NULL
      AND asin ~ '^[A-Z0-9]{10}$'
      AND (
        CASE
          WHEN amazon_images IS NOT NULL AND jsonb_typeof(amazon_images) = 'array'
          THEN jsonb_array_length(amazon_images)
          ELSE 0
        END
      ) < 2
    ORDER BY listed_at DESC NULLS LAST
    LIMIT 120
  `.catch(() => [])

  let fixed = 0
  let failed = 0
  const batchSize = 2

  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize)
    const results = await Promise.allSettled(batch.map(async (row) => {
      const asin = String(row.asin || '').toUpperCase()
      const product = await fetchAmazonProductByAsin({
        asin,
        fallbackTitle: row.title || undefined,
        fallbackImage: row.amazon_image_url || undefined,
        fallbackPrice: toNumber(row.amazon_price) || undefined,
        strictAsin: true,
      }).catch(() => null)

      if (!product || product.images.length < 2) return false

      await sql`
        UPDATE listed_asins
        SET
          amazon_images = ${JSON.stringify(product.images)},
          amazon_image_url = ${product.imageUrl || product.images[0] || null},
          amazon_price = CASE WHEN ${product.amazonPrice} > 0 THEN ${product.amazonPrice.toFixed(2)} ELSE amazon_price END,
          amazon_snapshot = COALESCE(amazon_snapshot, '{}'::jsonb) || ${JSON.stringify({
            asin: product.asin,
            title: product.title,
            amazonPrice: product.amazonPrice,
            imageUrl: product.imageUrl || product.images[0] || null,
            images: product.images,
            features: product.features,
            description: product.description,
            specs: product.specs,
            available: product.available,
            source: product.source,
            amazonUrl: `https://www.amazon.com/dp/${product.asin}`,
            repairSource: 'amazon_lookup',
          })}::jsonb
        WHERE id = ${row.id}
      `
      return true
    }))

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) fixed += 1
      else failed += 1
    }
  }

  return { fixed, failed }
}

async function fetchEbayActiveListings(base: string, accessToken: string): Promise<EbayListingMeta[]> {
  const appId = process.env.EBAY_APP_ID || ''
  if (!appId) return []

  const buildXml = (page: number) => `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${escapeXml(accessToken)}</eBayAuthToken></RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`

  const listings: EbayListingMeta[] = []
  for (let page = 1; page <= 5; page += 1) {
    const response = await fetch(`${base.replace('/sell', '')}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-APP-NAME': appId,
        'Content-Type': 'text/xml',
      },
      body: buildXml(page),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null)

    if (!response) break
    const text = await response.text()
    if (!response.ok || /<Ack>Failure<\/Ack>/i.test(text)) break

    const blocks = [...text.matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map((match) => match[1])
    for (const block of blocks) {
      const listingId = tag(block, 'ItemID')
      if (!listingId) continue
      listings.push({
        listingId,
        title: tag(block, 'Title'),
        categoryId: tag(block, 'CategoryID'),
        categoryName: tag(block, 'CategoryName'),
        pictures: Array.from(new Set(tags(block, 'PictureURL'))),
      })
    }

    if (blocks.length < 200) break
  }

  return listings
}

async function repairFromEbayActiveListings() {
  const users = await queryRows<UserRepairRow>`
    SELECT DISTINCT user_id
    FROM listed_asins
    WHERE ended_at IS NULL
      AND ebay_listing_id IS NOT NULL
      AND (
        category_id IS NULL
        OR category_id = ''
        OR (
          CASE
            WHEN amazon_images IS NOT NULL AND jsonb_typeof(amazon_images) = 'array'
            THEN jsonb_array_length(amazon_images)
            ELSE 0
          END
        ) < 2
      )
  `.catch(() => [])

  let categoryFixed = 0
  let imageFixed = 0
  let usersScanned = 0
  let usersSkipped = 0

  for (const user of users) {
    const credentials = await getValidEbayAccessToken(String(user.user_id)).catch(() => null)
    if (!credentials?.accessToken) {
      usersSkipped += 1
      continue
    }

    usersScanned += 1
    const base = credentials.sandboxMode ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
    const listings = await fetchEbayActiveListings(base, credentials.accessToken).catch(() => [])

    for (const listing of listings) {
      if (listing.categoryId) {
        const rows = await queryRows<{ id: number }>`
          UPDATE listed_asins
          SET
            category_id = ${listing.categoryId},
            category_name = ${listing.categoryName || null}
          WHERE user_id = ${user.user_id}
            AND ebay_listing_id = ${listing.listingId}
            AND ended_at IS NULL
            AND (category_id IS NULL OR category_id = '')
          RETURNING id
        `.catch(() => [])
        categoryFixed += rows.length
      }

      if (listing.pictures.length >= 2) {
        const rows = await queryRows<{ id: number }>`
          UPDATE listed_asins
          SET
            amazon_images = ${JSON.stringify(listing.pictures)},
            amazon_image_url = ${listing.pictures[0] || null},
            amazon_snapshot = COALESCE(amazon_snapshot, '{}'::jsonb) || ${JSON.stringify({
              imageUrl: listing.pictures[0] || null,
              images: listing.pictures,
              repairSource: 'ebay_active_listing',
            })}::jsonb
          WHERE user_id = ${user.user_id}
            AND ebay_listing_id = ${listing.listingId}
            AND ended_at IS NULL
            AND (
              CASE
                WHEN amazon_images IS NOT NULL AND jsonb_typeof(amazon_images) = 'array'
                THEN jsonb_array_length(amazon_images)
                ELSE 0
              END
            ) < 2
          RETURNING id
        `.catch(() => [])
        imageFixed += rows.length
      }
    }
  }

  return { categoryFixed, imageFixed, usersScanned, usersSkipped }
}

async function repairFallbackCategories() {
  const rows = await queryRows<CategoryRepairRow>`
    SELECT id, niche, title
    FROM listed_asins
    WHERE ended_at IS NULL
      AND (category_id IS NULL OR category_id = '')
    LIMIT 1000
  `.catch(() => [])

  let fixed = 0
  for (const row of rows) {
    const categoryId = inferFallbackCategoryId(row)
    if (!categoryId) continue

    const updated = await queryRows<{ id: number }>`
      UPDATE listed_asins
      SET category_id = ${categoryId}
      WHERE id = ${row.id}
        AND (category_id IS NULL OR category_id = '')
      RETURNING id
    `.catch(() => [])
    fixed += updated.length
  }

  return fixed
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  await ensureListedAsinsFinancialColumns()

  const cacheImagesFixed = await repairImagesFromAmazonCache()
  const ebayRepair = await repairFromEbayActiveListings()
  const amazonLookup = await repairImagesFromAmazonLookup()
  const fallbackCategoriesFixed = await repairFallbackCategories()

  const totalImagesFixed = cacheImagesFixed + ebayRepair.imageFixed + amazonLookup.fixed
  const totalCategoriesFixed = ebayRepair.categoryFixed + fallbackCategoriesFixed

  return apiOk({
    message: `Fix All complete. Repaired ${totalImagesFixed} image record(s) and ${totalCategoriesFixed} category record(s) across all accounts. Scanned ${ebayRepair.usersScanned} connected eBay account(s); skipped ${ebayRepair.usersSkipped} account(s) without a usable token.`,
    fixed: {
      images: totalImagesFixed,
      categories: totalCategoriesFixed,
      cacheImages: cacheImagesFixed,
      ebayImages: ebayRepair.imageFixed,
      amazonLookupImages: amazonLookup.fixed,
      ebayCategories: ebayRepair.categoryFixed,
      fallbackCategories: fallbackCategoriesFixed,
    },
    unresolved: {
      amazonLookupFailed: amazonLookup.failed,
      usersSkipped: ebayRepair.usersSkipped,
    },
  })
}
