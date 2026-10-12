// 👉 Link page — edits the public /hello page (the link in the Instagram bio): the line
// under the name, the sections, links and affiliates, plus what visitors open and tap (lib/hello-stats.ts). Socials come from lib/socials.ts
// and the email from lib/agent-site.ts, so they are shown here but not edited.
import { readHello } from '@/lib/hello'
import { readVersion } from '@/lib/v3/version'
import { supabaseConfigured } from '@/lib/supabase'
import { readHelloStats, RANGES } from '@/lib/hello-stats'
import type { Count } from '@/lib/hello-insights'
import { EMAIL } from '@/lib/agent-site'
import { SOCIALS } from '@/lib/socials'
import LinksEditor from './LinksEditor'
import '@/app/_v3/v3.css'
import './links.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–')
const fmt = (n: number) => n.toLocaleString('en-MY')

function Bars({ rows, of }: { rows: Count[]; of: number }) {
  const top = Math.max(1, ...rows.map(r => r.count))
  return rows.length ? (
    <ol className="lk-bars">
      {rows.map(r => (
        <li key={r.id}>
          <span className="lk-bar-label" title={r.label}>{r.label}</span>
          <span className="lk-bar-track"><span className="lk-bar-fill" style={{ width: `${(r.count / top) * 100}%` }} /></span>
          <b>{fmt(r.count)}</b>
          <small>{pct(r.count, of)}</small>
        </li>
      ))}
    </ol>
  ) : <p className="v3-empty">Nothing yet in this range.</p>
}

function Panel({ id, title, note, span = 6, children }: { id: string; title: string; note: string; span?: 4 | 6 | 12; children: React.ReactNode }) {
  return (
    <section className={`v3-panel v3-span-${span}`} aria-labelledby={id}>
      <div className="v3-panel-head">
        <h2 className="v3-panel-title" id={id}>{title}</h2>
        <p className="v3-panel-note">{note}</p>
      </div>
      {children}
    </section>
  )
}

export default async function Links({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams
  const asked = Number(Array.isArray(q.days) ? q.days[0] : q.days)
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30
  const [config, { version }] = await Promise.all([readHello(), readVersion()])
  const st = await readHelloStats(config, days)
  const peak = st ? Math.max(1, ...st.daily.map(d => d.visitors)) : 1
  const page = (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Link page</h1>
          <p className="v3-lede">
            The page behind the link in your Instagram bio: <a href="/hello" target="_blank" rel="noopener">aereonwong.com/hello</a>.
            Your own visits and bots are never counted.
          </p>
        </div>
        <nav className="v3-seg lk-range" aria-label="Range">
          {RANGES.map(r => (
            <a key={r} href={`/links?days=${r}`} aria-current={r === days ? 'page' : undefined} className={r === days ? 'is-on' : ''}>{r} days</a>
          ))}
        </nav>
      </header>
      <div className="v3-grid">
        {st ? (
          <>
            <section className="v3-panel v3-span-12 lk-kpis" aria-label={`Last ${days} days`}>
              {[
                { n: st.visitors, l: 'Visitors', s: `${fmt(st.visits)} page views` },
                { n: st.opened, l: 'Opened a section', s: `${pct(st.opened, st.visitors)} of visitors` },
                { n: st.emailed, l: 'Started an email', s: `${pct(st.emailed, st.visitors)} of visitors` },
                { n: st.promo, l: 'Opened a promo', s: `${pct(st.promo, st.visitors)} of visitors` },
                { n: st.social, l: 'Went to a social', s: `${pct(st.social, st.visitors)} of visitors` },
              ].map(k => (
                <div key={k.l} className="lk-kpi">
                  <span>{k.l}</span>
                  <b>{fmt(k.n)}</b>
                  <small>{k.s}</small>
                </div>
              ))}
            </section>

            <Panel id="lk-st-day" title="Visitors per day" note={`Last ${days} days · Malaysia time`} span={12}>
              <ol className={`lk-days${days > 30 ? ' lk-days-dense' : ''}`}>
                {st.daily.map(d => (
                  <li key={d.day} title={`${d.day}: ${d.visitors} visitor${d.visitors === 1 ? '' : 's'}`}>
                    <span style={{ height: `${(d.visitors / peak) * 100}%` }} />
                  </li>
                ))}
              </ol>
              <p className="lk-days-axis"><span>{st.daily[0]?.day}</span><span>peak {fmt(peak === 1 && !st.daily.some(d => d.visitors) ? 0 : peak)} a day</span><span>{st.daily.at(-1)?.day}</span></p>
            </Panel>

            <Panel id="lk-st-sec" title="What visitors came for" note="Opened each section → then emailed or tapped a link in it">
              {st.sections.length ? (
                <table className="lk-table">
                  <thead><tr><th>Section</th><th>Opened</th><th>Acted</th><th>Rate</th></tr></thead>
                  <tbody>
                    {st.sections.map(s => (
                      <tr key={s.id}><td>{s.label}</td><td>{fmt(s.opened)}</td><td>{fmt(s.acted)}</td><td>{pct(s.acted, s.opened)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="v3-empty">Nothing yet in this range.</p>}
            </Panel>
            <Panel id="lk-st-out" title="What they tapped" note="Links, emails, socials and copies · % of page views">
              <Bars rows={st.clicks} of={st.visits} />
            </Panel>

            <Panel id="lk-st-src" title="Where they came from" note="By app, tag or site" span={4}>
              <Bars rows={st.sources} of={st.visits} />
            </Panel>
            <Panel id="lk-st-geo" title="Countries" note="% of page views" span={4}>
              <Bars rows={st.countries} of={st.visits} />
            </Panel>
            <Panel id="lk-st-city" title="Cities & devices" note="% of page views" span={4}>
              <Bars rows={st.cities} of={st.visits} />
              <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.devices} of={st.visits} /></div>
            </Panel>
            <p className="v3-span-12 v3-panel-note lk-tip">
              Tip: tag links you post elsewhere so they show up by name under &ldquo;Where they came from&rdquo;, e.g.
              <code> aereonwong.com/hello?utm_source=story</code> for a Story or <code>?utm_source=tiktok</code> for your TikTok bio.
              Instagram and Threads visits are recognised automatically.
            </p>
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
