/**
 * Redacts sidebar display name (bottom-left) and lightly enhances clarity for homepage previews.
 */
import sharp from 'sharp'
import { readFile, writeFile, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const files = [
  'public/preview-product-listing.png',
  'public/preview-financials.png',
  'public/preview-performance.png',
]

async function avgColor(buf, left, top, width, height) {
  const { data, info } = await sharp(buf)
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let r = 0
  let g = 0
  let b = 0
  const n = info.width * info.height
  const ch = info.channels
  for (let i = 0; i < data.length; i += ch) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
  }
}

async function processOne(relPath) {
  const abs = join(root, relPath)
  const input = await readFile(abs)
  const meta = await sharp(input).metadata()
  const w = meta.width || 1024
  const h = meta.height || 520

  // Keep overlay inside the real sidebar (~22–26% width) so it never covers product cards
  const sidebarW = Math.min(Math.round(w * 0.26), 268)
  // Username sits just above "Sign out" in the bottom of the sidebar
  const bandH = Math.round(Math.max(36, h * 0.082))
  const bandTop = h - bandH - Math.round(h * 0.058)

  const sampleTop = Math.max(0, bandTop - 20)
  const sampleH = Math.min(24, bandTop - sampleTop)
  const { r, g, b } = await avgColor(input, 28, sampleTop, Math.min(100, sidebarW - 40), Math.max(1, sampleH))
  const fill = `rgb(${r},${g},${b})`

  const maskSvg = Buffer.from(
    `<svg width="${w}" height="${h}">
      <rect x="0" y="${bandTop}" width="${sidebarW}" height="${bandH}" fill="${fill}"/>
    </svg>`
  )

  const tmp = abs + '.tmp'
  await sharp(input)
    .composite([{ input: maskSvg, top: 0, left: 0 }])
    .modulate({ brightness: 1.05, saturation: 1.05 })
    .sharpen({ sigma: 0.5, m1: 0.45, m2: 2.5 })
    .png({ compressionLevel: 9 })
    .toFile(tmp)

  await writeFile(abs, await readFile(tmp))
  await unlink(tmp)

  console.log('[process-preview-screenshots]', relPath, `${w}x${h}`, `band y=${bandTop}-${bandTop + bandH}`)
}

for (const f of files) {
  await processOne(f)
}
