// 👉 Link page — edits the public /hello page (the link in the Instagram bio): the line
// under the name, the collab card and the list of links. Socials come from lib/socials.ts
// and the email from lib/agent-site.ts, so they are shown here but not edited.
import { readHello } from '@/lib/hello'
import { readVersion } from '@/lib/v3/version'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { klDay } from '@/lib/site-visits'
import { EMAIL } from '@/lib/agent-site'
import { SOCIALS } from '@/lib/socials'
import LinksEditor from './LinksEditor'
import '@/app/_v3/v3.css'
import './links.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

/** Page views of /hello in the last 30 days (site_visits; the owner and bots are never logged). */
async function views30(): Promise<number | null> {
  if (!supabaseConfigured) return null
  const since = klDay(new Date(Date.now() - 29 * 86_400_000))
  const { count, error } = await supabase.from('site_visits').select('id', { count: 'exact', head: true })
    .eq('path', '/hello').gte('day', since)
  return error ? null : count ?? 0
}

export default async function Links() {
  const [config, { version }, views] = await Promise.all([readHello(), readVersion(), views30()])
  const page = (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Link page</h1>
          <p className="v3-lede">
            The page behind the link in your Instagram bio: <a href="/hello" target="_blank" rel="noopener">aereonwong.com/hello</a>.
            {views !== null ? ` ${views.toLocaleString('en-MY')} visits in the last 30 days.` : ''}
          </p>
        </div>
      </header>
      <div className="v3-grid">
        <LinksEditor
          initial={config}
          dbReady={supabaseConfigured}
          email={EMAIL}
          socials={SOCIALS.map(s => s.name)}
        />
      </div>
    </div>
  )
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
