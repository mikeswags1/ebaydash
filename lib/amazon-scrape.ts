// Direct Amazon page scraper — used as fallback when RapidAPI quota is exhausted
// Fetches product data straight from amazon.com with no API key required

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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
  description: string
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

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
}

function upgradeAmazonImageUrl(url: string): string {
  return decodeHtmlEntities(url)
    .replace(/\\/g, '')
    .replace(/\._[^.]+(?=\.(jpg|jpeg|png|webp))/gi, '')
    .replace(/\.(jpg|jpeg|png|webp)\?.*$/i, '.$1')
}

function dedupeImages(values: string[]) {
  return Array.from(new Set(values.filter((url) => url.startsWith('http')).map((url) => upgradeAmazonImageUrl(url))))
}

function extractDynamicImageUrls(html: string): string[] {
  const urls: string[] = []

  for (const dynamicImageMatch of html.matchAll(/data-a-dynamic-image="([^"]+)"/g)) {
    if (urls.length >= 12) break
    if (!dynamicImageMatch?.[1]) continue
    const decoded = decodeHtmlEntities(dynamicImageMatch[1])
    for (const match of decoded.matchAll(/https:[^"]+\.(?:jpg|jpeg|png|webp)/gi)) {
      if (urls.length >= 12) break
      const url = upgradeAmazonImageUrl(match[0])
      if (url.startsWith('http') && !urls.includes(url)) urls.push(url)
    }
  }

  for (const pattern of [
    /"hiRes"\s*:\s*"(https:[^"]+)"/g,
    /"large"\s*:\s*"(https:[^"]+)"/g,
    /"mainUrl"\s*:\s*"(https:[^"]+)"/g,
    /data-old-hires="(https:[^"]+)"/g,
  ]) {
    for (const match of html.matchAll(pattern)) {
      if (urls.length >= 12) break
      const url = upgradeAmazonImageUrl(match[1])
      if (url.startsWith('http') && !urls.includes(url)) urls.push(url)
    }
  }

  for (const match of html.matchAll(/"mainUrl":"(https:[^"]+)"/g)) {
    if (urls.length >= 12) break
    const url = upgradeAmazonImageUrl(match[1])
    if (url.startsWith('http') && !urls.includes(url)) urls.push(url)
  }

  for (const match of html.matchAll(/"thumb":"(https:[^"]+)"/g)) {
    if (urls.length >= 12) break
    const url = upgradeAmazonImageUrl(match[1])
    if (url.startsWith('http') && !urls.includes(url)) urls.push(url)
  }

  for (const match of html.matchAll(/data-thumb-action="[^"]*(https:[^"&]+)[^"]*"/g)) {
    if (urls.length >= 12) break
    const url = upgradeAmazonImageUrl(match[1])
    if (url.startsWith('http') && !urls.includes(url)) urls.push(url)
  }

  for (const match of html.matchAll(/class="[^"]*imageThumbnail[^"]*"[\s\S]*?<img[^>]+src="(https:[^"]+)"/g)) {
    if (urls.length >= 12) break
    const url = upgradeAmazonImageUrl(match[1])
    if (url.startsWith('http') && !urls.includes(url)) urls.push(url)
  }

  return urls
}

function extractColorImageUrls(html: string): string[] {
  const images: string[] = []
  const colorImagesIdx =
    html.indexOf('"colorImages"') !== -1 ? html.indexOf('"colorImages"') : html.indexOf("'colorImages'")

  if (colorImagesIdx === -1) return images

  const section = html.slice(colorImagesIdx, colorImagesIdx + 100000)
  const initialIdx = section.indexOf('"initial"') !== -1 ? section.indexOf('"initial"') : section.indexOf("'initial'")
  if (initialIdx === -1) return images

  const arrayStart = section.indexOf('[', initialIdx)
  if (arrayStart === -1) return images

  let depth = 0
  let arrayEnd = -1
  for (let i = arrayStart; i < Math.min(arrayStart + 50000, section.length); i += 1) {
    if (section[i] === '[') depth += 1
    else if (section[i] === ']') {
      depth -= 1
      if (depth === 0) {
        arrayEnd = i
        break
      }
    }
  }

  if (arrayEnd === -1) return images

  const initialArray = section.slice(arrayStart, arrayEnd + 1)
  for (const pattern of [/"hiRes"\s*:\s*"(https:[^"]+)"/g, /"large"\s*:\s*"(https:[^"]+)"/g]) {
    for (const match of initialArray.matchAll(pattern)) {
      if (images.length >= 12) break
      const url = upgradeAmazonImageUrl(match[1])
      if (!images.includes(url)) images.push(url)
    }
    if (images.length > 0) break
  }

  return images
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

    let title = ''
    const titlePatterns = [
      /id="productTitle"[^>]*>\s*([^<]{5,200})/,
      /id="title"[^>]*>\s*<span[^>]*>\s*([^<]{5,200})/,
    ]
    for (const pattern of titlePatterns) {
      const match = html.match(pattern)
      if (match) {
        title = match[1].trim()
        break
      }
    }
    if (!title) return null

    let price = 0
    const pricePatterns = [
      /"priceAmount":(\d+\.?\d*)/,
      /class="a-price-whole">(\d[\d,]*)</,
      /"price":"?\$?([\d,]+\.?\d*)"/,
      /id="priceblock_ourprice"[^>]*>\s*\$?([\d,]+\.?\d*)/,
      /id="priceblock_dealprice"[^>]*>\s*\$?([\d,]+\.?\d*)/,
      /"buyingPrice":"?\$?([\d,]+\.?\d*)"/,
    ]
    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''))
        if (value > 0) {
          price = value
          break
        }
      }
    }

    let images = dedupeImages([
      ...extractDynamicImageUrls(html),
      ...extractColorImageUrls(html),
    ]).slice(0, 12)

    if (images.length === 0) {
      const mainImg =
        html.match(/id="landingImage"[^>]*data-a-dynamic-image="([^"]+)"/) ||
        html.match(/id="imgBlkFront"[^>]*src="(https:[^"]+)"/)
      if (mainImg) images = [upgradeAmazonImageUrl(mainImg[1].split('"')[0])]
    }

    const features: string[] = []
    const bulletSection = extractBetween(html, 'id="feature-bullets"', '</ul>')
    if (bulletSection) {
      const items = bulletSection.match(/<span[^>]*class="a-list-item"[^>]*>([\s\S]*?)<\/span>/g) || []
      for (const item of items) {
        const text = stripTags(item)
        if (text && text.length > 10 && text.length < 300 && !text.toLowerCase().includes('make sure')) {
          features.push(text)
          if (features.length >= 8) break
        }
      }
    }

    const specs: Array<[string, string]> = []
    const specSection =
      extractBetween(html, 'id="productDetails_techSpec_section_1"', '</table>') ||
      extractBetween(html, 'id="productDetails_db_sections"', '</table>')
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

    const descriptionSources = [
      extractBetween(html, 'id="productDescription"', '</div>'),
      extractBetween(html, 'id="bookDescription_feature_div"', '</div>'),
      extractBetween(html, 'id="aplus_feature_div"', '</div>'),
      extractBetween(html, '"productDescription":"', '","'),
    ]
    const description = descriptionSources
      .map((source) => stripTags(decodeHtmlEntities(source)))
      .find((source) => source.length > 60) || ''

    const available = !html.includes('Currently unavailable') && !html.includes('unavailable.')

    return {
      asin,
      title: stripTags(title),
      price,
      images,
      features,
      description,
      specs,
      available,
    }
  } catch {
    return null
  }
}

// Search Amazon for products in a niche — scrapes search results page
export async function scrapeAmazonSearch(
  query: string,
  page = 1
): Promise<Array<{ asin: string; title: string; price: number; imageUrl: string; rating: number; reviewCount: number }>> {
  try {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&page=${page}`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []

    const html = await res.text()
    if (html.includes('api-services-support@amazon.com') || html.length < 30000) return []

    const results: Array<{ asin: string; title: string; price: number; imageUrl: string; rating: number; reviewCount: number }> = []
    const productBlocks =
      html.match(/data-asin="([A-Z0-9]{10})"[\s\S]*?data-component-type="s-search-result"[\s\S]*?(?=data-asin="|$)/g) ||
      []

    for (const block of productBlocks) {
      if (results.length >= 20) break
      const asinMatch = block.match(/data-asin="([A-Z0-9]{10})"/)
      if (!asinMatch) continue
      const foundAsin = asinMatch[1]

      const titleMatch =
        block.match(/class="a-size-medium[^"]*a-color-base[^"]*a-text-normal"[^>]*>([\s\S]*?)<\/span>/) ||
        block.match(/class="a-size-base-plus[^"]*"[^>]*>([\s\S]*?)<\/span>/)
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

      results.push({ asin: foundAsin, title, price, imageUrl, rating, reviewCount })
    }

    return results
  } catch {
    return []
  }
}
