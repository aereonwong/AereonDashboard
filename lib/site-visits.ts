import crypto from 'node:crypto'

// 👉 First-party visitor log for the PUBLIC pages. Pure helpers — the route (app/api/track)
// does the I/O. Nothing here stores an IP address: visitors are told apart by a hash that
// includes the day, so it counts unique visitors per day and cannot follow anyone further.

/** Only these public pages are logged. Anything else is ignored, so private paths never land here. */
export const TRACKED_PATHS = ['/', '/about', '/contact', '/privacy', '/hello', '/login']

/** Taps on the /hello link page, logged as pseudo-paths beside the page views:
 *  /hello/tap/<section> = a "What brings you here?" section opened,
 *  /hello/out/<id>      = a link, email button, social icon or copy button used.
 *  Only lowercase ids, so nothing a visitor types can land in the log. */
export const HELLO_EVENT = /^\/hello\/(tap\/(collab|shoot|drone|deals|gear)|out\/[a-z0-9-]{1,40})$/
/** Most /hello tap rows one visitor may add per 10 minutes — made-up ids can't flood the log. */
export const HELLO_TAP_CAP = 20

export const isTrackedPath = (path: string) => TRACKED_PATHS.includes(path) || HELLO_EVENT.test(path)

const BOT = /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|vercel|facebookexternalhit|whatsapp|telegram|discord|slack/i

export const isBot = (ua: string) => !ua || BOT.test(ua)

export function parseUa(ua: string) {
  const device = /ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))
    ? 'tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'mobile' : 'desktop'
  // Apps' built-in browsers first: that is how a bio link or a shared link is usually opened,
  // and the app is the best clue to where the visitor came from (they rarely send a referrer).
  const browser = /instagram/i.test(ua) ? 'Instagram app' : /barcelona/i.test(ua) ? 'Threads app'
    : /fban|fbav|fb_iab/i.test(ua) ? 'Facebook app' : /musical_ly|bytedancewebview|tiktok/i.test(ua) ? 'TikTok app'
    : /xhsdiscover|xiaohongshu/i.test(ua) ? 'Xiaohongshu app' : /\bline\//i.test(ua) ? 'LINE app'
    : /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera'
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
