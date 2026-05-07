import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const extDir = path.join(root, 'extension')
const outDir = path.join(root, 'public')
const outFile = path.join(outDir, 'stackpilot-fulfillment-extension.zip')

if (!fs.existsSync(extDir)) {
  console.warn('[zip-extension] extension/ missing; skip')
  process.exit(0)
}

fs.mkdirSync(outDir, { recursive: true })

const output = fs.createWriteStream(outFile)
const archive = archiver('zip', { zlib: { level: 9 } })

await new Promise((resolve, reject) => {
  output.on('close', resolve)
  archive.on('error', reject)
  archive.pipe(output)
  archive.directory(extDir, false)
  archive.finalize()
})

console.log('[zip-extension] wrote', path.relative(root, outFile), archive.pointer(), 'bytes')
