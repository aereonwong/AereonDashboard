import PublicPage, { pageMetadata } from '@/app/_components/PublicPage'
import { PAGES } from '@/lib/agent-site'

const page = PAGES.find(p => p.slug === 'privacy')!
export const metadata = pageMetadata(page)

export default function Page() {
  return <PublicPage page={page} />
}
