import { Fragment, type ReactNode } from 'react'
import { analyse } from '@/lib/instagram'
import type { Audience } from '@/lib/v3/audience'
import type { Lab } from '@/lib/v3/content-lab'
import GrowthRhythm from '../GrowthRhythm'
import { FollowFlow, ReachBeyond, ShelfCurve } from '../IgInsights'
import AudienceBreakdown from '../AudienceBreakdown'
import Refresh from '../Refresh'
import ScopedPanel from '../ScopedPanel'
import ContentLab, { type Cover } from './ContentLab'
import { followFlow, reachVsFollowers, shelfLife } from '@/lib/v3/ig-insights'
import type { IgExtras } from '@/lib/v3/ig-extras'
import { compact, num, longDate } from '../fmt'
import { KpiCard } from '../summary/Panels'

// 👉 v3 Instagram — one page (16 Oct 2026; the Studio and Content Lab views merged at Aereon's request).
//
// Two kinds of figure, kept apart the way docs/FILTER-BAR.md says:
//   · ACCOUNT figures (Instagram's own account insights: followers, 30/90-day reach, the daily
//     line, who follows) and post lifespan — built here on the server, fixed, every panel
//     marked "ignores filters". Growth sits ABOVE the filter bar; lifespan and Audience below.
//   · POST figures (this year's posts from the archive) — ContentLab, filtered in the browser
//     by the one sticky bar.
// "Typical" always means the MEDIAN post, so one viral reel cannot redefine normal.

const FIXED = 'Account-wide · ignores filters'

export default function Instagram({ audience, lab, extras }: { audience: Audience; lab: Lab; extras: IgExtras }) {
  const { snap, history, view, daily } = audience
  const username = snap?.username || 'aereonwong'

  if (!snap && !lab.posts.length) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">Instagram</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">No Instagram snapshot yet.</p>
          <Refresh label="Fetch my Instagram data" />
        </section>
      </div>
    )
  }

  // Slots handed to a client component arrive as a list of children there, so each root carries a key.
  const actions = (
    <div key="actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
      <Refresh />
      {snap ? <span className="v3-panel-note">Updated {longDate(snap.captured_at)}</span> : null}
    </div>
  )

  let growth: ReactNode = null
  if (snap) {
    // The account's own figures, last 30 days. The snapshot's recent posts are only used to pin
    // posts on the daily line and to find which ones brought followers.
    const base = analyse(snap, 30)
    const cutoff = (n: number) => new Date(Date.parse(snap.captured_at) - n * 86_400_000).toISOString().slice(0, 10)
    const first = history[0]
    const last = history.at(-1)
    const tracked = first && last ? Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000) : 0
    const t = view?.totals ?? {}
    const d90 = view?.d90 ?? null
    const net = view?.follows != null && view?.unfollows != null ? view.follows - view.unfollows : null
    const engagedPct = t.reach && t.accounts_engaged ? (t.accounts_engaged / t.reach) * 100 : null
    const flow = followFlow(snap.posts, daily)
    const beyond = reachVsFollowers(snap.posts, audience.followers, daily)

    growth = (
      <div key="growth" className="v3-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Growth</h2>
          <p className="v3-chapter-note">Is the account growing, and which posts grew it — Instagram&rsquo;s own account figures, whatever the filter below.</p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="The account, last 30 days">
          <KpiCard
            label="Followers"
            value={num(audience.followers)}
            k={{
              value: audience.followers,
              prev: net !== null ? audience.followers - net : null,
              delta: net !== null && audience.followers - net ? net / (audience.followers - net) : null,
              spark: history.filter(h => h.date >= cutoff(60)).map(h => h.followers),
            }}
            note={
              net !== null
                ? `${net >= 0 ? '+' : ''}${num(net)} in 30 days · ${num(view!.follows!)} followed, ${num(view!.unfollows!)} left`
                : tracked > 0
                  ? `tracked since ${longDate(first!.date)}`
                  : 'daily count starts with the next refresh'
            }
          />
          <KpiCard
            label={t.reach !== undefined ? 'Accounts reached · 30 days' : 'Post reach (combined)'}
            value={compact(t.reach ?? base.totals.reach)}
            k={t.reach !== undefined ? { value: t.reach, prev: null, delta: null, spark: daily.filter(d => d.day >= cutoff(30) && d.reach !== undefined).map(d => d.reach!) } : undefined}
            note={t.reach !== undefined ? `${compact(t.views ?? 0)} views` : `${compact(base.totals.views)} views · posts, last 30 days`}
          />
          <KpiCard label="New people" value={view?.newPeoplePct != null ? `${Math.round(view.newPeoplePct)}%` : '—'} note="of reach did not follow you" />
          <KpiCard
            label={engagedPct !== null ? 'Accounts engaged' : 'Interactions per reach'}
            value={engagedPct !== null ? `${engagedPct.toFixed(1)}%` : `${base.engagementRate.toFixed(1)}%`}
            note={engagedPct !== null ? `${compact(t.accounts_engaged!)} accounts interacted` : 'per combined post reach, last 30 days'}
          />
          <KpiCard label="Profile visits · 30 days" value={t.profile_views !== undefined ? compact(t.profile_views) : '—'} note={t.profile_links_taps || t.website_clicks ? `${num((t.profile_links_taps ?? 0) + (t.website_clicks ?? 0))} link taps` : ''} />
        </section>

        {d90 ? (
          <section className="v3-panel v3-span-12 v3-sum-band" aria-label="The account, last 90 days">
            <KpiCard label="Views · 90 days" value={d90.views !== null ? compact(d90.views) : '—'} note="three 30-day windows added up" />
            <KpiCard label="Best 30-day reach" value={d90.peakReach !== null ? compact(d90.peakReach) : '—'} note="unique accounts in one window · reach is never added across windows" />
            <KpiCard label="Interactions · 90 days" value={d90.interactions !== null ? compact(d90.interactions) : '—'} note={d90.likes !== null ? `${compact(d90.likes)} likes` : 'likes, comments, saves, shares'} />
            <KpiCard label="Shares · 90 days" value={d90.shares !== null ? compact(d90.shares) : '—'} note={d90.saves !== null ? `${compact(d90.saves)} saves` : ''} />
            <KpiCard label="Comments · 90 days" value={d90.comments !== null ? compact(d90.comments) : '—'} note={d90.profileViews !== null ? `${compact(d90.profileViews)} profile visits` : ''} />
          </section>
        ) : null}

        {daily.length >= 3 ? (
          <ScopedPanel id="daily" span={12} title="Reach and growth, day by day" note="Every post and story combined, with each recent post pinned on its day" scope={FIXED}>
            <GrowthRhythm days={daily} posts={snap.posts} median={base.baseline.median} />
          </ScopedPanel>
        ) : null}
        <ScopedPanel id="flow" span={6} title="Posts that brought followers" note="Followers gained in the 48 hours after each posting day" scope={FIXED}>
          <FollowFlow flow={flow} />
        </ScopedPanel>
        <ScopedPanel id="beyond" span={6} title="Reach beyond your followers" note="Each recent post against the followers you had that day" scope={FIXED}>
          <ReachBeyond v={beyond} />
        </ScopedPanel>
      </div>
    )
  }

  const readDays = new Set(extras.metrics.map(m => m.captured_at.slice(0, 10)))
  const firstRead = extras.metrics.length ? extras.metrics.reduce((m, r) => (r.captured_at < m ? r.captured_at : m), extras.metrics[0].captured_at) : null
  const timing = (
    <ScopedPanel key="shelf" id="shelf" span={12} title="How long a post lives" note="Share of its final reach, by days since posting" scope="Every tracked post · ignores filters">
      <ShelfCurve life={shelfLife(extras.metrics)} readingDays={readDays.size} since={firstRead} />
    </ScopedPanel>
  )

  const audienceSection =
    view && view.ages.length ? (
      <Fragment key="audience">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Audience</h2>
          <p className="v3-chapter-note">Who follows you, and where they are.</p>
        </div>
        <ScopedPanel
         
          id="who-follows"
          span={12}
          title="Who follows"
          note={`${view.coreAgePct !== null ? `${Math.round(view.coreAgePct)}% aged 25–44` : ''}${view.homePct !== null ? ` · ${Math.round(view.homePct)}% in Malaysia` : ''} · from Instagram’s follower demographics`}
          scope={FIXED}
        >
          <div className="v3-ig-audience">
            <AudienceBreakdown view={view} />
          </div>
        </ScopedPanel>
      </Fragment>
    ) : null

  // Covers for the ranked posts: the snapshot's own (its ~40 newest posts, URLs refreshed daily).
  const covers: Record<string, Cover> = {}
  for (const p of snap?.posts ?? []) if (p.thumb) covers[p.id] = { src: p.thumb, crop: p.crop }

  return <ContentLab lab={lab} username={username} actions={actions} growth={growth} timing={timing} audience={audienceSection} covers={covers} />
}
