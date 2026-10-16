// 👉 Site analytics → Link page: who opens /hello (the link in the Instagram bio) and what they
// open and tap. Read by lib/hello-stats.ts, maths in lib/hello-insights.ts. Setup is the Link page
// tab (/links). No IP is stored.
import { readHello } from '@/lib/hello'
import { readHelloStats } from '@/lib/hello-stats'
import { Bars, Panel, Kpis, Daily, Reached, Frame, rangeOf, fmt, pct } from '../parts'
import '@/app/_v3/v3.css'
import '../../links/links.css'

export const dynamic = 'force-dynamic'

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

export default async function LinkAnalytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const days = await rangeOf(searchParams)
  return (
    <Frame title="Link page" base="/analytics/link" days={days}
      lede={<>Who opens <a href="/hello" target="_blank" rel="noopener">aereonwong.com/hello</a>, the link in your bio. Edit it on the <a href="/links">Link page</a> setup tab.</>}>
      <HelloView days={days} />
    </Frame>
  )
}
