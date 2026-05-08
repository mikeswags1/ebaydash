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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'm.media-amazon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images-fe.ssl-images-amazon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images-eu.ssl-images-amazon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ecx.images-amazon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'media.amazon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ebayimg.com', pathname: '/**' },
    ],
  },
}

module.exports = nextConfig
