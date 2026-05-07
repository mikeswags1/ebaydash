const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Ensure COLLAB.md is bundled for /api/admin/collab on Vercel (fs read is not always traced).
  outputFileTracingIncludes: {
    '/api/admin/collab': ['./COLLAB.md'],
  },
}

module.exports = nextConfig
