// 👉 Link page — sets up the public /hello page (the link in the Instagram bio): the line
// under the name, the sections, links and affiliates. What visitors open and tap is on the
// Site analytics tab (/analytics?page=hello). Socials come from lib/socials.ts
// and the email from lib/agent-site.ts, so they are shown here but not edited.
import { readHello } from '@/lib/hello'
import { readVersion } from '@/lib/v3/version'
import { supabaseConfigured } from '@/lib/supabase'
import { EMAIL } from '@/lib/agent-site'
import { SOCIALS } from '@/lib/socials'
import LinksEditor from './LinksEditor'
import '@/app/_v3/v3.css'
import './links.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Links() {
  const [config, { version }] = await Promise.all([readHello(), readVersion()])
  const page = (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Link page</h1>
          <p className="v3-lede">
            The page behind the link in your Instagram bio: <a href="/hello" target="_blank" rel="noopener">aereonwong.com/hello</a>.
            Set it up here; who visits and what they tap is on Site analytics.
          </p>
        </div>
        <a className="v3-btn" href="/analytics?page=hello">Visitor analytics</a>
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
