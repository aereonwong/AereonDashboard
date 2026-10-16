// 👉 Site analytics — who visits the public pages and what they do there, in two views:
// Landing (aereonwong.com, lib/site-stats.ts + lib/landing-insights.ts) and Link page
// (/hello, lib/hello-stats.ts + lib/hello-insights.ts). Logged by app/api/track; the
// signed-in owner and bots are never counted, and no IP is stored. Setup for /hello
// stays on the Link page tab (/links).
import { readHello } from '@/lib/hello'
import { readVersion } from '@/lib/v3/version'
import { readHelloStats, RANGES } from '@/lib/hello-stats'
import { readLandingStats } from '@/lib/site-stats'
import { Bars, Panel, Kpis, Daily, Reached, fmt, pct } from './parts'
import '@/app/_v3/v3.css'
import '../links/links.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

const VIEWS = [{ id: 'landing', label: 'Landing' }, { id: 'hello', label: 'Link page' }] as const
type View = typeof VIEWS[number]['id']

async function LandingView({ days }: { days: number }) {
  const st = await readLandingStats(days)
  if (!st) return <p className="v3-empty v3-span-12">No visit log yet.</p>
  return (
    <>
      <Kpis label={`Landing, last ${days} days`} items={[
        { n: st.visitors, l: 'Visitors', s: `${fmt(st.visits)} page views` },
        { n: st.tapped, l: 'Tapped something', s: `${pct(st.tapped, st.visitors)} of visitors` },
        { n: st.emailed, l: 'Started an email', s: `${pct(st.emailed, st.visitors)} of visitors` },
        { n: st.social, l: 'Went to a social', s: `${pct(st.social, st.visitors)} of visitors` },
        { n: st.entered, l: 'Headed to the dashboard', s: `${fmt(st.signIn)} opened sign-in` },
      ]} />
      <Daily daily={st.daily} days={days} />

      <Panel id="an-l-out" title="What they tapped" note="Every link and button · % of page views">
        <Bars rows={st.clicks} of={st.visits} />
      </Panel>
      <Panel id="an-l-ver" title="Which landing they saw" note="Front door, media kit or motion reel">
        <Bars rows={st.versions} of={st.visits} />
      </Panel>

      <Panel id="an-l-scroll" title="How far they scrolled" note="Reached at least · % of visitors">
        <Reached rows={st.scroll} of={st.visitors} />
      </Panel>
      <Panel id="an-l-time" title="How long they stayed" note="With the page on screen · % of visitors">
        <Reached rows={st.time} of={st.visitors} />
      </Panel>

      <Panel id="an-l-src" title="Where they came from" note="By app, tag or site" span={4}>
        <Bars rows={st.sources} of={st.visits} />
      </Panel>
      <Panel id="an-l-geo" title="Countries & languages" note="% of page views" span={4}>
        <Bars rows={st.countries} of={st.visits} />
        <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.languages} of={st.visits} /></div>
      </Panel>
      <Panel id="an-l-dev" title="Cities, devices & browsers" note="% of page views" span={4}>
        <Bars rows={st.cities} of={st.visits} />
        <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.devices} of={st.visits} /></div>
        <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.browsers} of={st.visits} /></div>
      </Panel>
      <p className="v3-span-12 v3-panel-note lk-tip">
        Clicks, scroll, time on page and language are tracked from 16 Oct 2026; page views go back to 8 Oct.
        Tag where you share the site and it gets its own line: <code>aereonwong.com/?utm_source=pitch</code>.
      </p>
    </>
  )
}

async function HelloView({ days }: { days: number }) {
  const st = await readHelloStats(await readHello(), days)
  if (!st) return <p className="v3-empty v3-span-12">No visit log yet.</p>
  return (
    <>
      <Kpis label={`Link page, last ${days} days`} items={[
        { n: st.visitors, l: 'Visitors', s: `${fmt(st.visits)} page views` },
        { n: st.opened, l: 'Opened a section', s: `${pct(st.opened, st.visitors)} of visitors` },
        { n: st.emailed, l: 'Started an email', s: `${pct(st.emailed, st.visitors)} of visitors` },
        { n: st.promo, l: 'Opened a promo', s: `${pct(st.promo, st.visitors)} of visitors` },
        { n: st.social, l: 'Went to a social', s: `${pct(st.social, st.visitors)} of visitors` },
      ]} />
      <Daily daily={st.daily} days={days} />

      <Panel id="an-h-sec" title="What visitors came for" note="Opened each section → then emailed or tapped a link in it">
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
      <Panel id="an-h-out" title="What they tapped" note="Links, emails, socials and copies · % of page views">
        <Bars rows={st.clicks} of={st.visits} />
      </Panel>

      <Panel id="an-h-src" title="Where they came from" note="By app, tag or site" span={4}>
        <Bars rows={st.sources} of={st.visits} />
      </Panel>
      <Panel id="an-h-geo" title="Countries" note="% of page views" span={4}>
        <Bars rows={st.countries} of={st.visits} />
      </Panel>
      <Panel id="an-h-city" title="Cities & devices" note="% of page views" span={4}>
        <Bars rows={st.cities} of={st.visits} />
        <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.devices} of={st.visits} /></div>
      </Panel>
      <p className="v3-span-12 v3-panel-note lk-tip">
        Tip: tag each place you post the link and it gets its own line under &ldquo;Where they came from&rdquo;:
        Instagram bio <code>aereonwong.com/hello?utm_source=bio</code>, Story <code>?utm_source=story</code>,
        Reel caption <code>?utm_source=reel</code>, TikTok bio <code>?utm_source=tiktok</code>.
      </p>
    </>
  )
}

export default async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const asked = Number(one(q.days))
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30
  const view: View = one(q.page) === 'hello' ? 'hello' : 'landing'
  const { version } = await readVersion()
  const page = (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Site analytics</h1>
          <p className="v3-lede">
            {view === 'landing'
              ? <>Who opens <a href="/" target="_blank" rel="noopener">aereonwong.com</a> and what they do there.</>
              : <>Who opens <a href="/hello" target="_blank" rel="noopener">aereonwong.com/hello</a>, the link in your bio. Edit it on the <a href="/links">Link page</a> tab.</>}
            {' '}Your own visits and bots are never counted.
          </p>
        </div>
        <div className="an-switches">
          <nav className="v3-seg lk-range" aria-label="Page">
            {VIEWS.map(v => (
              <a key={v.id} href={`/analytics?page=${v.id}&days=${days}`} aria-current={v.id === view ? 'page' : undefined} className={v.id === view ? 'is-on' : ''}>{v.label}</a>
            ))}
          </nav>
          <nav className="v3-seg lk-range" aria-label="Range">
            {RANGES.map(r => (
              <a key={r} href={`/analytics?page=${view}&days=${r}`} aria-current={r === days ? 'page' : undefined} className={r === days ? 'is-on' : ''}>{r} days</a>
            ))}
          </nav>
        </div>
      </header>
      <div className="v3-grid">
        {view === 'landing' ? <LandingView days={days} /> : <HelloView days={days} />}
      </div>
    </div>
  )
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
