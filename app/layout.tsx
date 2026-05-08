import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter, Space_Grotesk } from 'next/font/google'
import Providers from './providers'
import { PwaRegistration } from './pwa-registration'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cormorant',
  weight: ['400', '500', '600', '700'],
})

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
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${cormorant.variable}`}>
      <body className={inter.className}>
        <PwaRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
