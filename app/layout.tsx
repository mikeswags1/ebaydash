import type { Metadata, Viewport } from 'next'
import Providers from './providers'
import { PwaRegistration } from './pwa-registration'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://stackpilot-app.vercel.app'),
  title: 'StackPilot | Professional eBay Operations Platform',
  description: 'Real-time eBay order management, listing workflows, catalog research, and performance tools for serious sellers.',
  applicationName: 'StackPilot',
  manifest: '/manifest.webmanifest',
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: 'StackPilot',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/stackpilot-icon.svg', type: 'image/svg+xml' },
      { url: '/stackpilot-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/stackpilot-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071827',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PwaRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
