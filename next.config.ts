import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Pin the workspace root to THIS folder. Without it, Next can pick a parent
// directory's lockfile as the root and print a confusing warning — beginners who
// clone this repo on its own never hit that, and this keeps it quiet regardless.
const here = dirname(fileURLToPath(import.meta.url))

// 🔒 Browser-side hardening on every response. Vercel already sends HSTS.
// frame-ancestors/X-Frame-Options stop another site framing the dashboard to
// trick clicks; nosniff stops a file being run as a different type; the
// referrer policy keeps private paths out of other sites' logs.
// The CSP also blocks plugins (object-src), stops an injected <base> tag re-pointing
// every link (base-uri), and only lets forms send to us or Google sign-in (form-action;
// Chrome checks the redirect after a submit too). Script/connect rules are left out on
// purpose: Next's inline scripts would need per-request nonces, and /voice calls
// VoiceStudio on http://127.0.0.1 — don't add upgrade-insecure-requests for that reason.
const csp = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join('; ')
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  turbopack: { root: here },
  poweredByHeader: false,
  // The client media kit is a static deck in public/mediakit; serve its page at /mediakit.
  async rewrites() {
    return [{ source: '/mediakit', destination: '/mediakit/index.html' }]
  },
  // One address for search engines: www is sent to the bare domain, so Google never splits
  // the site's ranking between two copies.
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'www.aereonwong.com' }], destination: 'https://aereonwong.com/:path*', permanent: true }]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
