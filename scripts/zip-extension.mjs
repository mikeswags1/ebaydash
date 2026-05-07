import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const extDir = path.join(root, 'extension')
const publicDir = path.join(root, 'public')
const outZip = path.join(publicDir, 'stackpilot-fulfillment-extension.zip')
const folderName = 'stackpilot-fulfillment-extension'

async function main() {
  try {
    await fs.access(path.join(extDir, 'manifest.json'))
  } catch {
    console.warn('[zip-extension] Missing extension/manifest.json — skip zip.')
    process.exit(0)
  }

  await fs.mkdir(publicDir, { recursive: true })

  await new Promise((resolve, reject) => {
    const output = createWriteStream(outZip)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(extDir, folderName)
    archive.finalize()
  })

  const stat = await fs.stat(outZip)
  console.log(`[zip-extension] Wrote ${outZip} (${stat.size} bytes)`)
}

main().catch((err) => {
  console.error('[zip-extension]', err)
  process.exit(1)
})
