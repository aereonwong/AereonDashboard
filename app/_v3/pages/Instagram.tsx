import { analyse, type IgSnapshot } from '@/lib/instagram'
import type { Audience } from '@/lib/v3/audience'
import IgFilters from '../IgFilters'
import PostGrid from '../PostGrid'
import ReachTimeline from '../ReachTimeline'
import DailyReach from '../DailyReach'
import AudienceBreakdown from '../AudienceBreakdown'
import Refresh from '../Refresh'
import { compact, num, longDate } from '../fmt'

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

export default function Instagram({ audience, sp }: { audience: Audience; sp: Params }) {
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
  const first = history[0]
  const last = history.at(-1)
  const tracked = first && last ? Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000) : 0
  const best = s.byType[0]
  const bestDay = s.byWeekday.filter(d => d.count >= 2)[0] ?? s.byWeekday[0]
  const byReach = [...s.posts].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))

  const t = view?.totals ?? {}
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
        {/* ------------------------------------------------ the account, last 30 days */}
        <section className="v3-panel v3-span-4" aria-labelledby="t-follow">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-follow">
              Followers
            </h2>
          </div>
          <div className="v3-follow">
            <span className="v3-follow-big">{num(audience.followers)}</span>
            {net !== null ? (
              <span className={`v3-follow-change${net < 0 ? ' down' : ''}`}>
                {net >= 0 ? '+' : ''}
                {num(net)} in 30 days
              </span>
            ) : null}
          </div>
          <p className="v3-panel-note" style={{ marginTop: 'var(--space-3)' }}>
            {net !== null
              ? `${num(view!.follows!)} followed, ${num(view!.unfollows!)} left. `
              : ''}
            {tracked > 0 ? `Daily count tracked since ${longDate(first!.date)}.` : 'Daily count starts with the next refresh.'}
          </p>
        </section>

        <section className="v3-panel v3-span-8" aria-label="The account, last 30 days">
          <div className="v3-kpis">
            <div>
              <div className="v3-kpi-label">Accounts reached</div>
              <div className="v3-kpi-value num">{compact(t.reach ?? s.totals.reach)}</div>
              <div className="v3-kpi-note">{compact(t.views ?? s.totals.views)} views · 30 days</div>
            </div>
            <div>
              <div className="v3-kpi-label">New people</div>
              <div className="v3-kpi-value num">{view?.newPeoplePct != null ? `${Math.round(view.newPeoplePct)}%` : '—'}</div>
              <div className="v3-kpi-note">of reach did not follow you</div>
            </div>
            <div>
              <div className="v3-kpi-label">Typical post</div>
              <div className="v3-kpi-value num">{compact(s.baseline.median)}</div>
              <div className="v3-kpi-note">
                median reach · top quarter {compact(s.baseline.p75)}+
              </div>
            </div>
            <div>
              <div className="v3-kpi-label">Accounts engaged</div>
              <div className="v3-kpi-value num">{engagedPct !== null ? `${engagedPct.toFixed(1)}%` : `${s.engagementRate.toFixed(1)}%`}</div>
              <div className="v3-kpi-note">
                {engagedPct !== null ? `${compact(t.accounts_engaged!)} accounts interacted` : 'of accounts reached who interacted'}
              </div>
            </div>
          </div>
        </section>

        {daily.length >= 2 ? (
          <section className="v3-panel v3-span-12" aria-labelledby="t-daily">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-daily">
                Reach, day by day
              </h2>
              <p className="v3-panel-note">
                Every post and story combined
                {t.profile_views ? ` · ${compact(t.profile_views)} profile visits` : ''}
                {t.profile_links_taps || t.website_clicks ? ` · ${num((t.profile_links_taps ?? 0) + (t.website_clicks ?? 0))} link taps` : ''}
              </p>
            </div>
            <DailyReach days={daily} />
          </section>
        ) : null}

        {/* ------------------------------------------------ the posts (filterable) */}
        <div className="v3-span-12">
          <IgFilters days={days} type={type} />
        </div>

        <section className="v3-panel v3-span-12" aria-labelledby="t-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-top">
              Top performances
            </h2>
            <p className="v3-panel-note">Ranked by accounts reached · badge compares with your typical post · tap to play</p>
          </div>
          <PostGrid posts={byReach} limit={8} lift={s.lift} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-time">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-time">
              What travelled
            </h2>
            <p className="v3-panel-note">Every post on the day it went out, raised by its reach</p>
          </div>
          <ReachTimeline posts={s.posts} />
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

        {/* ------------------------------------------------ who follows */}
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

        <section className="v3-panel v3-span-6" aria-labelledby="t-day">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-day">
              Best day to post
            </h2>
            {bestDay ? <p className="v3-panel-note">{bestDay.day} leads, from {bestDay.count} posts</p> : null}
          </div>
          <div className="v3-rows">
            {s.byWeekday.map(d => (
              <div key={d.day} className="v3-row">
                <div className="v3-row-main">
                  <div className="v3-row-title">{d.day}</div>
                  <div className="v3-row-sub">
                    {d.count} post{d.count === 1 ? '' : 's'}
                    {d.count < 2 ? ' · too few to trust' : ''}
                  </div>
                </div>
                <div className="v3-row-num">{compact(d.avgReach)}</div>
                <div className="v3-row-bar">
                  <i style={{ ['--w' as string]: (d.avgReach / (s.byWeekday[0]?.avgReach || 1)).toFixed(3) }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {s.quiet.length ? (
          <section className="v3-panel v3-span-6" aria-labelledby="t-quiet">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-quiet">
                Quietest posts
              </h2>
              <p className="v3-panel-note">Worth a look before making more of the same</p>
            </div>
            <PostGrid posts={s.quiet} limit={3} lift={s.lift} />
          </section>
        ) : null}
      </div>
    </div>
  )
}
