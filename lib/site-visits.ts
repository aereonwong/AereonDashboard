import crypto from 'node:crypto'

// 👉 First-party visitor log for the PUBLIC pages. Pure helpers — the route (app/api/track)
// does the I/O. Nothing here stores an IP address: visitors are told apart by a hash that
// includes the day, so it counts unique visitors per day and cannot follow anyone further.

/** Only these public pages are logged. Anything else is ignored, so private paths never land here. */
export const TRACKED_PATHS = ['/', '/about', '/contact', '/privacy', '/login']

const BOT = /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|vercel|facebookexternalhit|whatsapp|telegram|discord|slack/i

export const isBot = (ua: string) => !ua || BOT.test(ua)

export function parseUa(ua: string) {
  const device = /ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))
    ? 'tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'mobile' : 'desktop'
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera'
    : /samsungbrowser/i.test(ua) ? 'Samsung' : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other'
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /android/i.test(ua) ? 'Android' : /mac os x|macintosh/i.test(ua) ? 'macOS'
    : /linux|cros/i.test(ua) ? 'Linux' : 'Other'
  return { device, browser, os }
}

/** Calendar day in Kuala Lumpur (YYYY-MM-DD), the day the hash rotates on. */
export const klDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(d)

export function visitorHash(secret: string, ip: string, ua: string, day: string): string {
  return crypto.createHash('sha256').update(`${secret}|${day}|${ip}|${ua}`).digest('hex').slice(0, 32)
}

/** Host of a referrer URL, or null when absent, malformed or the site itself. */
export function referrerHost(ref: unknown, ownHost: string): string | null {
  if (typeof ref !== 'string' || !ref) return null
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase()
    const own = ownHost.replace(/^www\./, '').replace(/:\d+$/, '').toLowerCase()
    return h && h !== own ? h.slice(0, 120) : null
  } catch { return null }
}

export const clip = (v: unknown, n = 80): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null
