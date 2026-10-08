import type { MetadataRoute } from 'next'
import { sitemapEntries } from '@/lib/agent-site'

// Public pages only; everything else is behind the sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries()
}
