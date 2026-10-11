// 👉 Link page — edits the public /hello page (the link in the Instagram bio): the line
// under the name, the sections, links and affiliates, plus what visitors open and tap (lib/hello-stats.ts). Socials come from lib/socials.ts
// and the email from lib/agent-site.ts, so they are shown here but not edited.
import { readHello } from '@/lib/hello'
import { readVersion } from '@/lib/v3/version'
import { supabaseConfigured } from '@/lib/supabase'
import { readHelloStats, type Count } from '@/lib/hello-stats'
import { EMAIL } from '@/lib/agent-site'
import { SOCIALS } from '@/lib/socials'
import LinksEditor from './LinksEditor'
import '@/app/_v3/v3.css'
import './links.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Links() {
  const [config, { version }] = await Promise.all([readHello(), readVersion()])
  const stats = await readHelloStats(config)
  const views = stats?.visits ?? null
  const Bars = ({ rows, of }: { rows: Count[]; of: number }) => {
    const top = Math.max(1, ...rows.map(r => r.count))
    return rows.length ? (
      <ol className="lk-bars">
        {rows.map(r => (
          <li key={r.id}>
            <span className="lk-bar-label">{r.label}</span>
            <span className="lk-bar-track"><span className="lk-bar-fill" style={{ width: `${(r.count / top) * 100}%` }} /></span>
            <b>{r.count.toLocaleString('en-MY')}</b>
            <small>{of ? `${Math.round((r.count / of) * 100)}%` : ''}</small>
          </li>
        ))}
      </ol>
    ) : <p className="v3-empty">Nothing yet. Counts start from today.</p>
  }
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
        {stats ? (
          <>
            <section className="v3-panel v3-span-6" aria-labelledby="lk-st-sec">
              <div className="v3-panel-head">
                <h2 className="v3-panel-title" id="lk-st-sec">What visitors came for</h2>
                <p className="v3-panel-note">Sections opened, last {stats.days} days · % of visits</p>
              </div>
              <Bars rows={stats.sections} of={stats.visits} />
            </section>
            <section className="v3-panel v3-span-6" aria-labelledby="lk-st-out">
              <div className="v3-panel-head">
                <h2 className="v3-panel-title" id="lk-st-out">What they tapped</h2>
                <p className="v3-panel-note">Links, emails, socials and copies, last {stats.days} days · % of visits</p>
              </div>
              <Bars rows={stats.clicks} of={stats.visits} />
            </section>
          </>
        ) : null}
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
