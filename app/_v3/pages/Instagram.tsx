import { analyse, type IgSnapshot } from '@/lib/instagram'
import type { Audience } from '@/lib/v3/audience'
import IgFilters from '../IgFilters'
import PostGrid from '../PostGrid'
import ReachTimeline from '../ReachTimeline'
import GrowthRhythm from '../GrowthRhythm'
import { FollowFlow, TimeGrid, ThemeStrip, ReachBeyond, ShelfCurve, CollabPanel } from '../IgInsights'
import AudienceBreakdown from '../AudienceBreakdown'
import Refresh from '../Refresh'
import { followFlow, timeGrid, themes, reachVsFollowers, shelfLife, collabs } from '@/lib/v3/ig-insights'
import type { IgExtras } from '@/lib/v3/ig-extras'
import { compact, num, longDate, shortDate } from '../fmt'
import { KpiCard } from '../summary/Panels'

// 👉 v3 Instagram: is my audience growing, and what earns it.
//
// Two kinds of figure live here, and the page keeps them apart:
//   · ACCOUNT figures (Instagram's own 30-day account insights: reach, new
//     people, follows, daily line, who follows) — fixed to the last 30 days.
//   · POST figures (the latest 40 posts) — these follow the date and format filter.
// "Typical" always means the MEDIAN post, so one viral reel cannot redefine normal.

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const per100 = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1))

export default function Instagram({ audience, sp, extras }: { audience: Audience; sp: Params; extras: IgExtras }) {
  const days = ['7', '30', '90', 'all'].includes(one(sp.days) ?? '') ? one(sp.days)! : '30'
  const type = ['REELS', 'FEED'].includes(one(sp.type) ?? '') ? one(sp.type)! : ''
  const { snap, history, view, daily } = audience

  if (!snap) {
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

  const scoped: IgSnapshot = { ...snap, posts: type ? snap.posts.filter(p => (type === 'REELS' ? /REEL/i : /^(?!.*REEL)/i).test(p.type)) : snap.posts }
  const s = analyse(scoped, days === 'all' ? 3650 : Number(days))
  // The Growth band never follows the filter: its post figures are always every post, last 30 days.
  const base = analyse(snap, 30)
  const cutoff = (n: number) => new Date(Date.parse(snap.captured_at) - n * 86_400_000).toISOString().slice(0, 10)
  const first = history[0]
  const last = history.at(-1)
  const tracked = first && last ? Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000) : 0
  const best = s.byType[0]
  const byReach = [...s.posts].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))

  // The new analysis panels read every stored post — the date and format filter only steer the panels above them.
  const all = snap.posts
  const flow = followFlow(all, daily)
  const grid = timeGrid(all)
  const subjects = themes(all)
  const beyond = reachVsFollowers(all, audience.followers, daily)
  const life = shelfLife(extras.metrics)
  const brand = collabs(all, extras.linked, extras.reachById)
  const readDays = new Set(extras.metrics.map(m => m.captured_at.slice(0, 10)))
  const firstRead = extras.metrics.length ? extras.metrics.reduce((m, r) => (r.captured_at < m ? r.captured_at : m), extras.metrics[0].captured_at) : null

  const t = view?.totals ?? {}
  const d90 = view?.d90 ?? null
  const net = view?.follows != null && view?.unfollows != null ? view.follows - view.unfollows : null
  const engagedPct = t.reach && t.accounts_engaged ? (t.accounts_engaged / t.reach) * 100 : null

  // The verdict: the one sentence that answers "is it working?"
  const verdict = [
    t.reach ? `${compact(t.reach)} accounts reached in 30 days` : null,
    view?.newPeoplePct != null ? `${Math.round(view.newPeoplePct)}% of them new to you` : null,
    s.hits.length ? `${s.hits.length} post${s.hits.length === 1 ? '' : 's'} beat twice your typical reach` : null,
  ].filter(Boolean)

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Instagram</h1>
          <p className="v3-lede">
            {verdict.length ? `${verdict.join(', ')}. ` : ''}@{snap.username} · updated {longDate(snap.captured_at)}
          </p>
        </div>
        <Refresh />
      </header>

      <div className="v3-grid">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Growth</h2>
          <p className="v3-chapter-note">Is the account growing, and which posts grew it — the last 30 days, whatever the filter below.</p>
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
            label="Typical post"
            value={compact(base.baseline.median)}
            k={{ value: base.baseline.median, prev: null, delta: null, spark: [...base.posts].filter(p => p.reach !== undefined).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map(p => p.reach!) }}
            note={`median post reach, last 30 days · top quarter ${compact(base.baseline.p75)}+`}
          />
          <KpiCard
            label={engagedPct !== null ? 'Accounts engaged' : 'Interactions per reach'}
            value={engagedPct !== null ? `${engagedPct.toFixed(1)}%` : `${base.engagementRate.toFixed(1)}%`}
            note={engagedPct !== null ? `${compact(t.accounts_engaged!)} accounts interacted` : 'per combined post reach, last 30 days'}
          />
        </section>

        {d90 ? (
          <>
            <section className="v3-panel v3-span-12 v3-sum-band" aria-label="The account, last 90 days">
              <KpiCard label="Views · 90 days" value={d90.views !== null ? compact(d90.views) : '—'} note="three 30-day windows added up" />
              <KpiCard
                label="Best 30-day reach"
                value={d90.peakReach !== null ? compact(d90.peakReach) : '—'}
                note="unique accounts in one window · reach is never added across windows"
              />
              <KpiCard label="Interactions · 90 days" value={d90.interactions !== null ? compact(d90.interactions) : '—'} note={d90.likes !== null ? `${compact(d90.likes)} likes` : 'likes, comments, saves, shares'} />
              <KpiCard label="Shares · 90 days" value={d90.shares !== null ? compact(d90.shares) : '—'} note={d90.saves !== null ? `${compact(d90.saves)} saves` : ''} />
              <KpiCard label="Profile visits · 90 days" value={d90.profileViews !== null ? compact(d90.profileViews) : '—'} note={d90.comments !== null ? `${compact(d90.comments)} comments` : ''} />
            </section>
            <section className="v3-panel v3-span-12" aria-labelledby="t-90">
              <div className="v3-panel-head">
                <h2 className="v3-panel-title" id="t-90">
                  The last 90 days, 30 days at a time
                </h2>
                <p className="v3-panel-note">Instagram&rsquo;s own account figures · each window counts unique accounts once</p>
              </div>
              <div className="v3-table-wrap">
                <table className="v3-table">
                  <thead>
                    <tr>
                      <th>Window</th>
                      <th className="num">Accounts reached</th>
                      <th className="num">Views</th>
                      <th className="num">Interactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d90.windows.map(w => (
                      <tr key={w.since}>
                        <td>
                          {shortDate(w.since)} – {shortDate(w.until)}
                        </td>
                        <td className="num">{w.reach !== null ? num(w.reach) : '—'}</td>
                        <td className="num">{w.views !== null ? num(w.views) : '—'}</td>
                        <td className="num">{w.interactions !== null ? num(w.interactions) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        {daily.length >= 3 ? (
          <section className="v3-panel v3-span-12" aria-labelledby="t-daily">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-daily">
                Reach and growth, day by day
              </h2>
              <p className="v3-panel-note">
                Every post and story combined, with each post pinned on its day
                {t.profile_views ? ` · ${compact(t.profile_views)} profile visits` : ''}
                {t.profile_links_taps || t.website_clicks ? ` · ${num((t.profile_links_taps ?? 0) + (t.website_clicks ?? 0))} link taps` : ''}
              </p>
            </div>
            <GrowthRhythm days={daily} posts={all} median={s.baseline.median} />
          </section>
        ) : null}
        <section className="v3-panel v3-span-6" aria-labelledby="t-flow">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-flow">
              Posts that brought followers
            </h2>
            <p className="v3-panel-note">Followers gained in the 48 hours after each posting day</p>
          </div>
          <FollowFlow flow={flow} />
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-beyond">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-beyond">
              Reach beyond your followers
            </h2>
            <p className="v3-panel-note">Each post against the followers you had that day</p>
          </div>
          <ReachBeyond v={beyond} />
        </section>
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">What works</h2>
          <p className="v3-chapter-note">Your posts, judged against your typical post. The date and format filter steers the post panels here; subjects and brand work always use every stored post.</p>
        </div>

        <div className="v3-span-12">
          <IgFilters days={days} type={type} />
        </div>
        <section className="v3-panel v3-span-12" aria-labelledby="t-time">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-time">
              What travelled
            </h2>
            <p className="v3-panel-note">Every post on the day it went out, raised by its reach</p>
          </div>
          <ReachTimeline posts={s.posts} />
        </section>
        <section className="v3-panel v3-span-12" aria-labelledby="t-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-top">
              Top performances
            </h2>
            <p className="v3-panel-note">Ranked by accounts reached · badge compares with your typical post · tap to play</p>
          </div>
          <PostGrid posts={byReach} limit={8} lift={s.lift} />
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-attn">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-attn">
              What people did
            </h2>
            <p className="v3-panel-note">Per 100 accounts reached, posts in view</p>
          </div>
          <div className="v3-attn">
            <div>
              <div className="v3-attn-v num">{per100(s.rates.share)}</div>
              <div className="v3-attn-l">shares</div>
              <div className="v3-attn-n">{num(s.totals.shares)} in all — the strongest signal to the algorithm</div>
            </div>
            <div>
              <div className="v3-attn-v num">{per100(s.rates.save)}</div>
              <div className="v3-attn-l">saves</div>
              <div className="v3-attn-n">{num(s.totals.saves)} in all</div>
            </div>
            <div>
              <div className="v3-attn-v num">{per100(s.rates.comment)}</div>
              <div className="v3-attn-l">comments</div>
              <div className="v3-attn-n">{num(s.totals.comments)} in all</div>
            </div>
            <div>
              <div className="v3-attn-v num">{s.watch ? `${s.watch.avgSec.toFixed(1)}s` : '—'}</div>
              <div className="v3-attn-l">average Reel watch</div>
              <div className="v3-attn-n">
                {s.watch ? `${num(s.watch.totalHours)} hours watched across ${s.watch.reels} Reels` : 'Appears after the next refresh'}
              </div>
            </div>
          </div>
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-fmt">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fmt">
              What format works
            </h2>
            {best ? <p className="v3-panel-note">{best.type === 'REELS' ? 'Reels' : 'Posts'} reach furthest per post</p> : null}
          </div>
          <div className="v3-rows">
            {s.byType.map(t => (
              <div key={t.type} className="v3-row">
                <div className="v3-row-main">
                  <div className="v3-row-title">{t.type === 'REELS' ? 'Reels' : t.type === 'FEED' ? 'Posts' : t.type}</div>
                  <div className="v3-row-sub">
                    {t.count} · {t.avgEngagement.toFixed(1)}% engagement
                  </div>
                </div>
                <div className="v3-row-num">{compact(t.avgReach)} avg reach</div>
                <div className="v3-row-bar">
                  <i style={{ ['--w' as string]: (t.avgReach / (s.byType[0]?.avgReach || 1)).toFixed(3) }} />
                </div>
              </div>
            ))}
          </div>
          {view?.formats.length ? (
            <p className="v3-panel-note" style={{ marginTop: 'var(--space-4)' }}>
              Share of 30-day account reach:{' '}
              {view.formats
                .filter(f => f.pct >= 1)
                .map(f => `${f.label} ${Math.round(f.pct)}%`)
                .join(' · ')}
            </p>
          ) : null}
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-theme">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-theme">
              What subjects travel
            </h2>
            <p className="v3-panel-note">Posts grouped by what the caption is about</p>
          </div>
          <ThemeStrip rows={subjects.rows} typical={subjects.typical} all={all} />
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-collab">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-collab">
              Brand work vs your own
            </h2>
            <p className="v3-panel-note">Reach of paid and credited posts against organic ones</p>
          </div>
          <CollabPanel view={brand} />
        </section>
        {s.quiet.length ? (
          <section className="v3-panel v3-span-12" aria-labelledby="t-quiet">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-quiet">
                Quietest posts
              </h2>
              <p className="v3-panel-note">Worth a look before making more of the same</p>
            </div>
            <PostGrid posts={s.quiet} limit={3} lift={s.lift} />
          </section>
        ) : null}
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Audience</h2>
          <p className="v3-chapter-note">Who follows you, and where they are.</p>
        </div>

        {view && view.ages.length ? (
          <section className="v3-panel v3-span-12" aria-labelledby="t-who">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-who">
                Who follows
              </h2>
              <p className="v3-panel-note">
                {view.coreAgePct !== null ? `${Math.round(view.coreAgePct)}% aged 25–44` : ''}
                {view.homePct !== null ? ` · ${Math.round(view.homePct)}% in Malaysia` : ''} · from Instagram&rsquo;s follower demographics
              </p>
            </div>
            <div className="v3-ig-audience">
              <AudienceBreakdown view={view} />
            </div>
          </section>
        ) : null}
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Timing</h2>
          <p className="v3-chapter-note">When to post, and how long a post keeps finding people.</p>
        </div>

        <section className="v3-panel v3-span-6" aria-labelledby="t-day">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-day">
              When to post
            </h2>
            <p className="v3-panel-note">Median reach by weekday and time of day · Malaysia time</p>
          </div>
          <TimeGrid grid={grid} />
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-shelf">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-shelf">
              How long a post lives
            </h2>
            <p className="v3-panel-note">Share of its final reach, by days since posting</p>
          </div>
          <ShelfCurve life={life} readingDays={readDays.size} since={firstRead} />
        </section>
      </div>
    </div>
  )
}
