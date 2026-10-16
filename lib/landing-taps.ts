// 👉 Names what a visitor tapped on the landing page (/). Pure and import-free, so the browser
// tracker (app/_components/LandingTracker.tsx) and the Site analytics tab share one list, and the
// tests can load it. Every landing version (classic, media kits, reel) is covered without tagging
// each link: an element's own data-t wins, else the id comes from where the link goes.

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)facebook\.com$|^fb\.(com|me)$/, 'facebook'],
  [/(^|\.)threads\.(net|com)$/, 'threads'], [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube'], [/xiaohongshu\.com$|xhslink\.com$/, 'xhs'],
  [/(^|\.)linkedin\.com$/, 'linkedin'], [/(^|\.)(x|twitter)\.com$/, 'x'],
]
const SOCIAL_NAME: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', threads: 'Threads', youtube: 'YouTube',
  xhs: 'Xiaohongshu', linkedin: 'LinkedIn', x: 'X',
}
/** A link to one post or video rather than to the profile. */
const POST = /\/(p|reel|reels|tv|video|videos|posts|watch|shorts|story|stories|discovery\/item)\b/

const slug = (s: string, n = 34) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n)

/** The id logged as /land/out/<id>, or null for a tap that is not worth counting (an in-page anchor). */
export function landingTapId(href: string | null, dataT: string | null, origin: string): string | null {
  if (dataT) return slug(dataT, 40) || null
  if (!href) return null
  if (href.startsWith('mailto:')) return 'mail'
  if (href.startsWith('tel:')) return 'phone'
  if (href.startsWith('#')) return null
  let u: URL
  try { u = new URL(href, origin) } catch { return null }
  if (u.origin === origin) {
    if (u.pathname === '/') return null
    if (/^\/(dashboard|login)(\/|$)/.test(u.pathname)) return 'enter'
    return `page-${slug(u.pathname.split('/')[1] ?? '') || 'home'}`
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  const social = SOCIAL_HOSTS.find(([re]) => re.test(host))?.[1]
  if (social) return `${POST.test(u.pathname) ? 'post' : 'social'}-${social}`
  return `site-${slug(host)}`
}

const FIXED: Record<string, string> = {
  enter: 'Opened the dashboard', 'enter-top': 'Enter dashboard (top bar)', 'enter-cta': 'Dashboard button',
  mail: 'Email', 'mail-cta': 'Work with me (email)', phone: 'Phone call',
}

/** A readable name for a logged tap id. */
export function landingTapLabel(id: string): string {
  if (FIXED[id]) return FIXED[id]
  const [kind, ...rest] = id.split('-')
  const tail = rest.join('-')
  if (kind === 'social') return `Profile: ${SOCIAL_NAME[tail] ?? tail}`
  if (kind === 'post') return `A post on ${SOCIAL_NAME[tail] ?? tail}`
  if (kind === 'page') return `Page: /${tail === 'home' ? '' : tail}`
  if (kind === 'site') return `Site: ${tail.replace(/-/g, '.')}`
  return id
}

/** What kind of tap it is, for the "what visitors did" funnel. */
export function landingTapKind(id: string): 'email' | 'social' | 'post' | 'enter' | 'other' {
  if (id === 'mail' || id.startsWith('mail-') || id === 'phone') return 'email'
  if (id === 'enter' || id.startsWith('enter-')) return 'enter'
  if (id.startsWith('social-')) return 'social'
  if (id.startsWith('post-')) return 'post'
  return 'other'
}
