// 👉 Site analytics → Landing page: who opens aereonwong.com and what they do there (taps, scroll,
// time on page, language, version seen). Read by lib/site-stats.ts, maths in lib/landing-insights.ts,
// logged by app/_components/LandingTracker.tsx through app/api/track. No IP is stored.
import { readLandingStats } from '@/lib/site-stats'
import { Bars, Panel, Kpis, Daily, Reached, Frame, rangeOf, fmt, pct } from '../parts'
import '@/app/_v3/v3.css'
import '../../links/links.css'

export const dynamic = 'force-dynamic'

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

export default async function LandingAnalytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const days = await rangeOf(searchParams)
  return (
    <Frame title="Landing page" base="/analytics/landing" days={days}
      lede={<>Who opens <a href="/" target="_blank" rel="noopener">aereonwong.com</a> and what they do there.</>}>
      <LandingView days={days} />
    </Frame>
  )
}
