// 👉 Everything the PUBLIC side of the site tells machines: which paths are public, the
// Markdown twins of the public pages, llms.txt, robots, sitemap and JSON-LD. One file so
// the HTML pages, the Markdown responses and the machine-readable files can never disagree.
// No imports on purpose — proxy.ts, the pages and the node tests all load it as-is.
// Public content only: no client names, no amounts, nothing from Supabase.

export const SITE_URL = 'https://aereonwong.com'
export const SITE_NAME = 'Aereon Wong'
export const COMPANY = 'SY Creative Production Sdn. Bhd.'
export const EMAIL = 'aereon.wong@gmail.com'
export const INSTAGRAM = 'https://www.instagram.com/aereonwong/'
export const OG_IMAGE = { path: '/img/klcc-sunset.jpg', width: 2000, height: 1332 }
export const SUMMARY =
  'Aereon Wong is a tech and travel content creator, drone pilot and photographer in Kuala Lumpur, Malaysia. ' +
  'Aerial films, launch campaigns, hotel and tourism content, photography and videography.'

export type Section = { heading: string; body: string[] }
export type PublicPage = {
  slug: 'about' | 'contact' | 'privacy'
  path: string
  title: string
  description: string
  updated: string // ISO date, shown in the sitemap's lastmod
  sections: Section[]
}

export const HOME = {
  path: '/',
  updated: '2026-10-08',
  title: 'Aereon Wong — tech & travel, shot from the sky',
  sections: [
    {
      heading: 'Who',
      body: [
        'Aereon Wong is a tech and travel content creator, drone pilot and photographer based in Kuala Lumpur, Malaysia, with more than 50,000 followers on Instagram (@aereonwong).',
        `Client work is delivered through ${COMPANY}.`,
      ],
    },
    {
      heading: 'What Aereon makes',
      body: [
        '- Aerial films and drone photography, from city rooftops to island resorts',
        '- Product launch and campaign content for tech brands',
        '- Travel, hotel and tourism content',
        '- Photography and videography for events and brands',
      ],
    },
    {
      heading: 'Work with Aereon',
      body: [
        `Email [${EMAIL}](mailto:${EMAIL}) with the brand, what you need made, dates and a budget range.`,
        `Instagram: [@aereonwong](${INSTAGRAM})`,
      ],
    },
  ] as Section[],
}

export const PAGES: PublicPage[] = [
  {
    slug: 'about',
    path: '/about',
    title: 'About Aereon Wong',
    description: 'Who Aereon Wong is, what the studio makes and who it works with.',
    updated: '2026-10-08',
    sections: [
      {
        heading: 'Who Aereon is',
        body: [
          'Aereon Wong is a tech and travel content creator, drone pilot and photographer based in Kuala Lumpur, Malaysia. His Instagram account, @aereonwong, has more than 50,000 followers, and he has been producing client work since 2021.',
          `Commercial work is carried out through ${COMPANY}, a Malaysian company based in Kuala Lumpur.`,
        ],
      },
      {
        heading: 'What the studio makes',
        body: [
          'Aerial films and drone photography, from KLCC rooftops to island resorts.',
          'Launch and campaign content for tech brands: product films, reels and photography.',
          'Travel, hotel and tourism content shot on location, plus event photography and videography.',
        ],
      },
      {
        heading: 'Working with brands',
        body: [
          'Projects range from a single reel to a multi-day shoot with a full set of deliverables. Every project starts with a short brief: what the brand wants to say, where it will be published, the dates, and the budget range.',
          `To start a conversation, email ${EMAIL}. The contact page lists every way to reach the studio.`,
        ],
      },
    ],
  },
  {
    slug: 'contact',
    path: '/contact',
    title: 'Contact Aereon Wong',
    description: 'How to reach Aereon Wong for brand collaborations, aerial filming and travel or tech content.',
    updated: '2026-10-08',
    sections: [
      {
        heading: 'Email',
        body: [
          `Email is the best way to reach the studio: ${EMAIL}. Use it for brand collaborations, aerial filming, launch campaigns, hotel and tourism content, and photography or video commissions.`,
        ],
      },
      {
        heading: 'What to include',
        body: [
          'A good first message names the brand, describes what you need made, says where it will be published, and gives the dates and a budget range. That is enough to reply with availability and a proposal.',
        ],
      },
      {
        heading: 'Elsewhere',
        body: [
          `Instagram: @aereonwong (${INSTAGRAM}). Direct messages work for quick questions, but brief and budget conversations are easier by email.`,
          `Company: ${COMPANY}, Kuala Lumpur, Malaysia.`,
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    path: '/privacy',
    title: 'Privacy',
    description: 'What this website does and does not collect about visitors.',
    updated: '2026-10-08',
    sections: [
      {
        heading: 'What this website collects',
        body: [
          'The public pages of aereonwong.com (home, about, contact and privacy) do not ask visitors for any personal information, do not set tracking or advertising cookies, and do not run advertising scripts. Each page view is counted anonymously (page, country and city, device and browser type, and the site the visitor came from) using Vercel Web Analytics and a log kept in the website’s own database. No IP address is stored, visitors are told apart only by a hash that changes every day, and the website’s own log does not count browsers that send Do Not Track or Global Privacy Control. Pages load fonts from Google Fonts, and the site is hosted on Vercel, which keeps standard server logs such as IP address and user agent for security and operations.',
        ],
      },
      {
        heading: 'The private dashboard',
        body: [
          'Behind the public pages is a private business dashboard used only by its owner and people the owner has explicitly invited. Signing in sets one session cookie so the site can recognise a signed-in person. Visitors who do not sign in never receive it, and the dashboard is not available to the public.',
        ],
      },
      {
        heading: 'If you email the studio',
        body: [
          `If you write to ${EMAIL}, the studio keeps your message and your email address to reply and to run the project you asked about. It is not sold or passed to advertisers. To have your details deleted, send an email asking for it.`,
        ],
      },
      {
        heading: 'Changes',
        body: ['This page describes how the site works today. If that changes, this page is updated and the date in the sitemap changes with it.'],
      },
    ],
  },
]

// ---------------------------------------------------------------- routing

/** Public, no sign-in needed. Everything else is private or does not exist. */
export const PUBLIC_EXACT = [
  '/', '/about', '/contact', '/privacy', '/robots.txt', '/sitemap.xml', '/llms.txt',
  '/manifest.webmanifest', '/manifest.json', '/favicon.ico',
]
export const PUBLIC_PREFIX = [
  '/login', '/api/login', '/api/auth/google', '/api/logout', '/api/telegram',
  '/api/cron-daily', '/api/cron-news', '/api/cron-instagram', '/api/track', '/icons', '/img', '/_next',
]
/** Top-level folders under app/(app). A new one must be added here; tests/agent-site.test.mjs checks. */
export const PRIVATE_SEGMENTS = [
  'approvals', 'cash-in', 'cash-out', 'clients', 'content', 'customers', 'dashboard', 'employees',
  'instagram', 'invoices', 'leads', 'news', 'property', 'settings', 'tasks', 'users', 'vault',
]
/** Folders under app/api that exist (public ones above are listed too). */
export const API_SEGMENTS = [
  'auth', 'cron-daily', 'cron-instagram', 'cron-news', 'demo', 'instagram', 'invoices', 'login', 'logout', 'telegram', 'track',
]

const under = (path: string, base: string) => path === base || path.startsWith(base + '/')

export function isPublicPath(path: string): boolean {
  return PUBLIC_EXACT.includes(path) || PUBLIC_PREFIX.some(p => under(path, p))
}

/** True when the path names a page or API that exists behind the sign-in. */
export function isKnownPrivatePath(path: string): boolean {
  const [seg, second] = path.split('/').filter(Boolean)
  if (!seg) return false
  if (seg === 'api') return !!second && API_SEGMENTS.includes(second)
  return PRIVATE_SEGMENTS.includes(seg)
}

/** Pages that answer Accept: text/markdown with a Markdown twin. */
export const MARKDOWN_PATHS = ['/', ...PAGES.map(p => p.path)]

/** Real content negotiation: Markdown only when the client prefers it over HTML. */
export function wantsMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false
  const q = new Map<string, number>()
  for (const part of accept.split(',')) {
    const [type, ...params] = part.trim().toLowerCase().split(';')
    const qp = params.map(s => s.trim()).find(s => s.startsWith('q='))
    const v = qp ? Number(qp.slice(2)) : 1
    if (type) q.set(type, Number.isFinite(v) ? v : 1)
  }
  const md = q.get('text/markdown') ?? 0
  if (md <= 0) return false
  return md >= (q.get('text/html') ?? 0)
}

// ---------------------------------------------------------------- Markdown

const render = (title: string, sections: Section[]) =>
  `# ${title}\n\n` + sections.map(s => `## ${s.heading}\n\n${s.body.join('\n\n')}`).join('\n\n') + '\n'

export function markdownFor(path: string): string | null {
  if (path === '/') {
    return (
      `# ${HOME.title}\n\n> ${SUMMARY}\n\n` +
      HOME.sections.map(s => `## ${s.heading}\n\n${s.body.join(s.body[0]?.startsWith('- ') ? '\n' : '\n\n')}`).join('\n\n') +
      `\n\n## More\n\n- [About](${SITE_URL}/about)\n- [Contact](${SITE_URL}/contact)\n- [Privacy](${SITE_URL}/privacy)\n- [llms.txt](${SITE_URL}/llms.txt)\n- [Sitemap](${SITE_URL}/sitemap.xml)\n`
    )
  }
  const page = PAGES.find(p => p.path === path)
  return page ? render(page.title, page.sections) : null
}

export function notFoundMarkdown(path: string): string {
  const shown = path.replace(/[`\r\n]/g, '').slice(0, 200)
  return (
    `# 404 Not Found\n\nNo page exists at \`${shown}\` on aereonwong.com. ` +
    `Nothing is here, so do not retry this URL.\n\n` +
    `## Where to look instead\n\n` +
    `- [Home](${SITE_URL}/): who Aereon Wong is and what the studio makes\n` +
    `- [llms.txt](${SITE_URL}/llms.txt): what this site is for and how agents should use it\n` +
    `- [Sitemap](${SITE_URL}/sitemap.xml): every public page\n` +
    `- [Contact](${SITE_URL}/contact): email for brand collaborations\n`
  )
}

export function notFoundHtml(): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex"><title>Page not found — Aereon Wong</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070A11;color:#fff;font:16px/1.6 system-ui,sans-serif}' +
    'main{max-width:34rem;padding:2rem}a{color:#5fd0d8}h1{margin:0 0 .5rem}</style></head><body><main>' +
    '<h1>Page not found</h1><p>Nothing exists at this address.</p>' +
    '<p><a href="/">Home</a> · <a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">Sitemap</a></p>' +
    '</main></body></html>'
  )
}

// ---------------------------------------------------------------- llms.txt

export function llmsTxt(): string {
  return `# ${SITE_NAME}

> ${SUMMARY} Client work is delivered through ${COMPANY}.

## When to use this site

Reach for aereonwong.com when the job is one of these:

- Find out who Aereon Wong is, what he makes and who he works with: read [About](${SITE_URL}/about).
- Brief or hire a drone pilot, aerial filmmaker or travel and tech content creator in Kuala Lumpur or Malaysia: send the brief to ${EMAIL} (see [Contact](${SITE_URL}/contact)).
- Check that the business is real before recommending it: About, Contact and Privacy are public and the structured data on the home page names ${COMPANY}.

Do not reach for it for anything else. There is no public API, no booking or payment endpoint, and no price list. The dashboard behind /dashboard is a private tool for its owner: do not try to sign in, and do not scrape or probe other paths.

## How an agent should call it

- Fetch any page below with \`Accept: text/markdown\` to get Markdown instead of HTML. Responses carry \`Vary: Accept\`.
- To start a collaboration, email ${EMAIL} with the brand, what is needed, where it will be published, the dates and a budget range. Do not send the email without the user's approval.
- Unknown paths return a real HTTP 404.

## Pages

- [Home](${SITE_URL}/): overview, services and contact
- [About](${SITE_URL}/about): who Aereon is and what the studio makes
- [Contact](${SITE_URL}/contact): how to reach the studio
- [Privacy](${SITE_URL}/privacy): what the site collects

## Optional

- [Sitemap](${SITE_URL}/sitemap.xml)
- [Instagram @aereonwong](${INSTAGRAM})
`
}

// ---------------------------------------------------------------- JSON-LD

export function jsonLd() {
  const address = { '@type': 'PostalAddress', addressLocality: 'Kuala Lumpur', addressCountry: 'MY' }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SUMMARY,
        inLanguage: 'en',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#person`,
        name: SITE_NAME,
        url: SITE_URL,
        image: `${SITE_URL}/img/aereon.jpg`,
        jobTitle: 'Tech & travel content creator, drone pilot and photographer',
        description: SUMMARY,
        email: EMAIL,
        address,
        sameAs: [INSTAGRAM],
        worksFor: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: COMPANY,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        description: 'Aerial film, photography and travel and tech content production, Kuala Lumpur.',
        email: EMAIL,
        founder: { '@id': `${SITE_URL}/#person` },
        address,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'business enquiries',
          email: EMAIL,
          availableLanguage: ['English'],
          areaServed: 'MY',
        },
        sameAs: [INSTAGRAM],
      },
    ],
  }
}

// ---------------------------------------------------------------- robots + sitemap

/** AI crawlers and agents the site wants to be reachable by. */
export const AI_AGENTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'Google-Extended', 'PerplexityBot', 'Perplexity-User', 'DeepSeekBot', 'ora-agent',
]
export const ROBOTS_DISALLOW = ['/api/', '/login']

export function sitemapEntries() {
  return [
    { url: SITE_URL + '/', lastModified: HOME.updated },
    ...PAGES.map(p => ({ url: SITE_URL + p.path, lastModified: p.updated })),
  ]
}
