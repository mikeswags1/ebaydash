import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StackPilot',
    short_name: 'StackPilot',
    description: 'A private operations dashboard for managing marketplace listings, orders, performance, and launch health.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06111f',
    theme_color: '#071827',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/stackpilot-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/stackpilot-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/stackpilot-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
