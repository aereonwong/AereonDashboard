import type { MetadataRoute } from 'next'
import { AI_AGENTS, ROBOTS_DISALLOW, SITE_URL } from '@/lib/agent-site'

// Crawlers and AI agents may read the public pages; the API and login are off limits.
// Each AI agent gets its own group (groups do not merge) so none is left "unknown".
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ROBOTS_DISALLOW },
      ...AI_AGENTS.map(userAgent => ({ userAgent, allow: '/', disallow: ROBOTS_DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
