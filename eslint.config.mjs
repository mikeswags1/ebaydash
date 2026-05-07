import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const nextConfig = require('eslint-config-next/core-web-vitals')

export default [
  ...nextConfig,
  {
    name: 'stackpilot-overrides',
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]

