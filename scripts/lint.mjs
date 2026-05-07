import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const eslintPkg = require.resolve('eslint/package.json')
const eslintBin = path.join(path.dirname(eslintPkg), 'bin', 'eslint.js')

const result = spawnSync(process.execPath, [eslintBin, '.'], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(typeof result.status === 'number' ? result.status : 1)

