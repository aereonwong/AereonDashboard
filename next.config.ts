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
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  turbopack: { root: here },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
