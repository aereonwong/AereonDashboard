// 👉 Site analytics → Media kit: who opens the client deck at aereonwong.com/mediakit and what they
// do there (slides seen, work opened, PDF downloads, emails). Read by lib/site-stats.ts, maths in
// lib/kit-insights.ts, logged by the deck's own inline script (public/mediakit/index.html) through
// app/api/track. No IP is stored.
import { readKitStats } from '@/lib/site-stats'
import { readKitLinks } from '@/lib/kit-links'
import KitLinks from './KitLinks'
import { Bars, Panel, Kpis, BotNote, Daily, Reached, Frame, rangeOf, fmt, pct } from '../parts'
import '@/app/_v3/v3.css'
import '../../links/links.css'
import './kit.css'

export const dynamic = 'force-dynamic'

async function KitView({ days }: { days: number }) {
  const { links } = await readKitLinks()
  const st = await readKitStats(days, Object.fromEntries(links.map(l => [l.code, l.brand])))
  const shareLinks = (
    <Panel id="an-k-links" title="Share links" note="One private link per brand · the brand is never in the link" span={12}>
      <KitLinks days={days} rows={links.map(l => ({ ...l, stats: st?.tags.find(t => t.code === l.code) ?? null }))} />
    </Panel>
  )
  if (!st) return <>{shareLinks}<p className="v3-empty v3-span-12">No visit log yet.</p></>
  return (
    <>
      {shareLinks}
      <Kpis label={`Media kit, last ${days} days`} items={[
        { n: st.visitors, l: 'Visitors', s: `${fmt(st.visits)} page views` },
        { n: st.finished, l: 'Reached Contact', s: `${pct(st.finished, st.visitors)} saw the last slide` },
        { n: st.work, l: 'Opened a post', s: `${pct(st.work, st.visitors)} of visitors` },
        { n: st.pdf, l: 'Downloaded the PDF', s: `${pct(st.pdf, st.visitors)} of visitors` },
        { n: st.emailed, l: 'Started an email or call', s: `${fmt(st.social)} went to a social` },
      ]} />
      <BotNote bots={st.bots} />
      <Daily daily={st.daily} days={days} />

      <Panel id="an-k-slides" title="How far through the deck" note="Saw at least this slide · % of visitors">
        <Reached rows={st.slides} of={st.visitors} />
      </Panel>
      <Panel id="an-k-out" title="What they tapped" note="Posts, PDF, email and socials · % of page views">
        <Bars rows={st.clicks} of={st.visits} />
      </Panel>

      <Panel id="an-k-time" title="How long they stayed" note="With the page on screen · % of visitors">
        <Reached rows={st.time} of={st.visitors} />
      </Panel>
      <Panel id="an-k-src" title="Where they came from" note="By app, tag or site">
        <Bars rows={st.sources} of={st.visits} />
      </Panel>

      <Panel id="an-k-geo" title="Countries & languages" note="% of page views" span={4}>
        <Bars rows={st.countries} of={st.visits} />
        <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.languages} of={st.visits} /></div>
      </Panel>
      <Panel id="an-k-city" title="Cities" note="% of page views" span={4}>
        <Bars rows={st.cities} of={st.visits} />
      </Panel>
      <Panel id="an-k-dev" title="Devices & browsers" note="% of page views" span={4}>
        <Bars rows={st.devices} of={st.visits} />
        <div style={{ marginTop: 'var(--space-4)' }}><Bars rows={st.browsers} of={st.visits} /></div>
      </Panel>
      <p className="v3-span-12 v3-panel-note lk-tip">
        Tracked from 18 Oct 2026. Send each brand its own share link (top of this page): visits from it show under
        Where they came from as that brand, and only here.
      </p>
    </>
  )
}

export default async function KitAnalytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const days = await rangeOf(searchParams)
  return (
    <Frame title="Media kit" base="/analytics/mediakit" days={days}
      lede={<>Who opens your <a href="/mediakit" target="_blank" rel="noopener">media kit</a> and how far they get.</>}>
      <KitView days={days} />
    </Frame>
  )
}
