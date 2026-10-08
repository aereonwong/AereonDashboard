import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { SITE_URL, SITE_NAME, OG_IMAGE } from '@/lib/agent-site'

// The ROOT layout: html, body, fonts and the photo background only. The dashboard
// chrome (sidebar + bottom bar) lives in app/(app)/layout.tsx, so the public
// landing page at / and the login screen render full-bleed without it.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Aereon Dashboard',
  description:
    'Aereon Wong — tech & travel creator, Kuala Lumpur. Invoices, clients, Instagram and AI agents in one place.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE.path] },
  appleWebApp: { capable: true, title: 'Aereon', statusBarStyle: 'black-translucent' },
}

// theme-color drives the phone status-bar tint when installed to the home screen.
export const viewport: Viewport = {
  themeColor: '#070A11',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=Sora:wght@500;600;700&family=Archivo:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Replays the saved look before first paint so nothing flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement,g=localStorage;var m=g.getItem('cfo-theme'),a=g.getItem('cfo-accent'),gl=g.getItem('cfo-glass'),f=g.getItem('cfo-font'),b=g.getItem('cfo-bg');if(m==='light'||m==='dark')d.setAttribute('data-theme',m);if(a&&a!=='blue')d.setAttribute('data-accent',a);if(gl==='clear'||gl==='solid')d.setAttribute('data-glass',gl);d.setAttribute('data-font',f||'grotesk');d.setAttribute('data-bg',b==='photo'?'merdeka':(b||'merdeka'));var v=g.getItem('cfo-v3-accent');if(v&&v!=='indigo')d.setAttribute('data-v3accent',v)}catch(e){document.documentElement.setAttribute('data-font','grotesk');document.documentElement.setAttribute('data-bg','merdeka')}",
          }}
        />
      </head>
      <body>
        {/* The KLCC photo + the coloured veil that keeps text readable over it. */}
        <div className="bg-photo" aria-hidden="true" />
        <div className="bg-veil" aria-hidden="true" />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
