// Direct Amazon page scraper — used as fallback when RapidAPI quota is exhausted
// Fetches product data straight from amazon.com with no API key required

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
}

export interface AmazonProduct {
  asin: string
  title: string
  price: number
  images: string[]
  features: string[]
  specs: Array<[string, string]>
  available: boolean
}

function extractBetween(html: string, open: string, close: string): string {
  const start = html.indexOf(open)
  if (start === -1) return ''
  const end = html.indexOf(close, start + open.length)
  if (end === -1) return ''
  return html.slice(start + open.length, end).trim()
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export async function scrapeAmazonProduct(asin: string): Promise<AmazonProduct | null> {
  try {
    const res = await fetch(`https://www.amazon.com/dp/${asin}?th=1&psc=1`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const html = await res.text()
    if (html.includes('api-services-support@amazon.com') || html.length < 50000) return null

    // ── Title ────────────────────────────────────────────────────────────────
    let title = ''
    const titlePatterns = [
      /id="productTitle"[^>]*>\s*([^<]{5,200})/,
      /id="title"[^>]*>\s*<span[^>]*>\s*([^<]{5,200})/,
    ]
    for (const p of titlePatterns) {
      const m = html.match(p)
      if (m) { title = m[1].trim(); break }
    }
    if (!title) return null

    // ── Price ────────────────────────────────────────────────────────────────
    let price = 0
    const pricePatterns = [
      /"priceAmount":(\d+\.?\d*)/,
      /class="a-price-whole">(\d[\d,]*)</,
      /"price":"?\$?([\d,]+\.?\d*)"/,
      /id="priceblock_ourprice"[^>]*>\s*\$?([\d,]+\.?\d*)/,
      /id="priceblock_dealprice"[^>]*>\s*\$?([\d,]+\.?\d*)/,
      /"buyingPrice":"?\$?([\d,]+\.?\d*)"/,
    ]
    for (const p of pricePatterns) {
      const m = html.match(p)
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ''))
        if (val > 0) { price = val; break }
      }
    }

    // ── Images — extract only from colorImages.initial (this ASIN's variant only) ─
    const images: string[] = []
    const colorImagesIdx = html.indexOf('"colorImages"') !== -1
      ? html.indexOf('"colorImages"')
      : html.indexOf("'colorImages'")
    if (colorImagesIdx !== -1) {
      const section = html.slice(colorImagesIdx, colorImagesIdx + 100000)
      // Find the 'initial' key — Amazon uses both single and double quotes
      const initialIdx = section.indexOf('"initial"') !== -1
        ? section.indexOf('"initial"')
        : section.indexOf("'initial'")
      if (initialIdx !== -1) {
        const arrayStart = section.indexOf('[', initialIdx)
        if (arrayStart !== -1) {
          // Walk brackets to find the matching ] for the initial array
          let depth = 0, arrayEnd = -1
          for (let i = arrayStart; i < Math.min(arrayStart + 50000, section.length); i++) {
            if (section[i] === '[') depth++
            else if (section[i] === ']') { depth--; if (depth === 0) { arrayEnd = i; break } }
          }
          if (arrayEnd !== -1) {
            const initialArray = section.slice(arrayStart, arrayEnd + 1)
            for (const pattern of [/"hiRes"\s*:\s*"(https:[^"]+)"/g, /"large"\s*:\s*"(https:[^"]+)"/g]) {
              for (const m of initialArray.matchAll(pattern)) {
                if (images.length >= 6) break
                if (!images.includes(m[1])) images.push(m[1])
              }
              if (images.length > 0) break
            }
          }
        }
      }
    }
    // fallback: main image
    if (images.length === 0) {
      const mainImg = html.match(/id="landingImage"[^>]*data-a-dynamic-image="([^"]+)"/)
        || html.match(/id="imgBlkFront"[^>]*src="(https:[^"]+)"/)
      if (mainImg) images.push(mainImg[1].split('"')[0])
    }

    // ── Bullet features ──────────────────────────────────────────────────────
    const features: string[] = []
    const bulletSection = extractBetween(html, 'id="feature-bullets"', '</ul>')
    if (bulletSection) {
      const items = bulletSection.match(/<span[^>]*class="a-list-item"[^>]*>([\s\S]*?)<\/span>/g) || []
      for (const item of items) {
        const text = stripTags(item)
        if (text && text.length > 10 && text.length < 300 && !text.toLowerCase().includes('make sure')) {
          features.push(text)
          if (features.length >= 6) break
        }
      }
    }

    // ── Tech specs table ─────────────────────────────────────────────────────
    const specs: Array<[string, string]> = []
    const specSection = extractBetween(html, 'id="productDetails_techSpec_section_1"', '</table>')
      || extractBetween(html, 'id="productDetails_db_sections"', '</table>')
    if (specSection) {
      const rows = specSection.match(/<tr[\s\S]*?<\/tr>/g) || []
      for (const row of rows) {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g) || []
        if (cells.length >= 2) {
          const key = stripTags(cells[0] ?? '')
          const val = stripTags(cells[1] ?? '')
          if (key && val && key.length < 60 && val.length < 200) {
            specs.push([key, val])
            if (specs.length >= 12) break
          }
        }
      }
    }

    const available = !html.includes('Currently unavailable') && !html.includes('unavailable.')

    return { asin, title: stripTags(title), price, images, features, specs, available }
  } catch {
    return null
  }
}

// Search Amazon for products in a niche — scrapes search results page
export async function scrapeAmazonSearch(query: string, page = 1): Promise<Array<{ asin: string; title: string; price: number; imageUrl: string; rating: number; reviewCount: number }>> {
  try {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&page=${page}`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const html = await res.text()
    if (html.includes('api-services-support@amazon.com') || html.length < 30000) return []

    const results: Array<{ asin: string; title: string; price: number; imageUrl: string; rating: number; reviewCount: number }> = []

    // Products appear in data-asin attributes on result divs
    const productBlocks = html.match(/data-asin="([A-Z0-9]{10})"[\s\S]*?data-component-type="s-search-result"[\s\S]*?(?=data-asin="|$)/g) || []

    for (const block of productBlocks) {
      if (results.length >= 20) break
      const asinMatch = block.match(/data-asin="([A-Z0-9]{10})"/)
      if (!asinMatch) continue
      const asin = asinMatch[1]

      const titleMatch = block.match(/class="a-size-medium[^"]*a-color-base[^"]*a-text-normal"[^>]*>([\s\S]*?)<\/span>/)
        || block.match(/class="a-size-base-plus[^"]*"[^>]*>([\s\S]*?)<\/span>/)
      const title = titleMatch ? stripTags(titleMatch[1]) : ''
      if (!title || title.length < 5) continue

      const priceMatch = block.match(/"a-price-whole"[^>]*>(\d[\d,]*)</)
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0

      const imgMatch = block.match(/class="s-image"[^>]*src="(https:[^"]+)"/)
      const imageUrl = imgMatch ? imgMatch[1] : ''

      const ratingMatch = block.match(/aria-label="([\d.]+) out of 5 stars"/)
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0

      const reviewMatch = block.match(/aria-label="([\d,]+) ratings"/)
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : 0

      if (asin && title) results.push({ asin, title, price, imageUrl, rating, reviewCount })
    }
    return results
  } catch {
    return []
  }
}
