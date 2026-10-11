import { analyseFb, followerFlow, engagement, type Facebook as Fb, type FbPostRow } from '@/lib/facebook'
import FbFilters from '../FbFilters'
import SeriesChart, { type SeriesPoint } from '../SeriesChart'
import Refresh from '../Refresh'
import { KpiCard } from '../summary/Panels'
import { compact, num, longDate, shortDate } from '../fmt'

// 👉 v3 Facebook: is the Page growing, and which posts earn it.
//
// Two kinds of figure, kept apart as on Instagram:
//   · PAGE figures (Facebook's own day-by-day and 28-day totals) — fixed windows.
//   · POST figures (stored posts with their latest views) — these follow the filter.
// Viewers are unique people and are never added across days, windows or posts;
// views (every showing) can be. "Typical" is the MEDIAN post.

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const per100 = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`
const TYPE_LABEL: Record<string, string> = { VIDEO: 'Videos', PHOTO: 'Photos', LINK: 'Links', TEXT: 'Text posts' }
const delta = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? (a - b) / b : null)
const title = (p: FbPostRow) => (p.message ?? '').split('\n')[0].trim() || TYPE_LABEL[p.type] || 'Post'

function PostList({ posts, lift }: { posts: FbPostRow[]; lift: (p: FbPostRow) => number | null }) {
  if (!posts.length) return <p className="v3-empty">No posts with view figures in this window.</p>
  return (
    <div className="v3-fb-posts">
      {posts.map(p => {
        const x = lift(p)
        const body = (
          <>
            {p.picture ? (
              // Facebook CDN links expire; a broken one just shows the grey frame behind it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.picture} alt="" loading="lazy" />
            ) : (
              <span className="ph" aria-hidden="true" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="t">{title(p)}</div>
              <div className="s">
                {TYPE_LABEL[p.type] ?? p.type} · {p.posted_at ? shortDate(p.posted_at) : '—'} · {num(p.reactions ?? 0)} reactions · {num(p.comments ?? 0)} comments ·{' '}
                {num(p.shares ?? 0)} shares
              </div>
            </div>
            <div className="v">
              {p.viewers !== null ? compact(p.viewers) : '—'}
              <small>
                viewers{x !== null && (x >= 1.5 || x <= 0.5) ? ` · ${x >= 1 ? `${x.toFixed(1)}×` : `${Math.round(x * 100)}% of`} typical` : ''}
              </small>
            </div>
          </>
        )
        return p.permalink ? (
          <a key={p.post_id} className="v3-fb-post" href={p.permalink} target="_blank" rel="noopener noreferrer">
            {body}
          </a>
        ) : (
          <div key={p.post_id} className="v3-fb-post">
            {body}
          </div>
        )
      })}
    </div>
  )
}

export default function Facebook({ fb, sp }: { fb: Fb; sp: Params }) {
  const days = ['30', '90', '365'].includes(one(sp.days) ?? '') ? one(sp.days)! : '30'
  const type = ['VIDEO', 'PHOTO'].includes(one(sp.type) ?? '') ? one(sp.type)! : ''

  if (!fb.daily.length && !fb.posts.length) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">Facebook</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">
            No Facebook history yet. Run <code>supabase/facebook.sql</code> once in Supabase, then fetch — or run <code>npm run fb:backfill</code> on the Mac for
            the full history.
          </p>
          <Refresh label="Fetch my Facebook data" endpoint="/api/facebook/refresh" />
        </section>
      </div>
    )
  }

  const now = Date.now()
  const base = analyseFb(fb.posts, 30, now)
  const s = analyseFb(type ? fb.posts.filter(p => p.type === type) : fb.posts, Number(days), now)
  const flow = followerFlow(fb.daily, 30)
  const w = fb.window
  const pw = fb.prevWindow
  const viewersDelta = delta(w?.viewers, pw?.viewers)
  const cutoff = (n: number) => new Date(now - n * 86_400_000).toISOString().slice(0, 10)
  const recent = fb.daily.filter(d => d.day >= cutoff(90))
  const followersLine = fb.daily.filter(d => d.day >= cutoff(60) && d.followers).map(d => d.followers!)

  // Views per month — views add up; months before Facebook reported views are left out.
  const firstViews = fb.daily.find(d => d.views)?.day
  const byMonth = new Map<string, number>()
  for (const d of fb.daily) if (firstViews && d.day >= firstViews) byMonth.set(d.day.slice(0, 7), (byMonth.get(d.day.slice(0, 7)) ?? 0) + (d.views ?? 0))
  const months: SeriesPoint[] = [...byMonth.entries()].map(([k, v]) => ({ key: k, label: monthLabel(k), value: v }))
  // Followers at the end of each month.
  const endOf = new Map<string, number>()
  for (const d of fb.daily) if (d.followers) endOf.set(d.day.slice(0, 7), d.followers)
  const followerMonths: SeriesPoint[] = [...endOf.entries()].map(([k, v]) => ({ key: k, label: monthLabel(k), value: v }))

  const verdict = [
    w?.viewers ? `${compact(w.viewers)} people saw the Page in 28 days` : null,
    viewersDelta !== null ? `${viewersDelta >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(viewersDelta * 100))}% on the 28 days before` : null,
    base.hits.length ? `${base.hits.length} post${base.hits.length === 1 ? '' : 's'} beat twice your typical` : null,
  ].filter(Boolean)

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Facebook</h1>
          <p className="v3-lede">
            {verdict.length ? `${verdict.join(', ')}. ` : ''}Aereon Wong Page{fb.updated ? ` · updated ${longDate(fb.updated)}` : ''}
          </p>
        </div>
        <Refresh label="Refresh from Facebook" endpoint="/api/facebook/refresh" />
      </header>

      <div className="v3-grid">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Growth</h2>
          <p className="v3-chapter-note">Facebook&rsquo;s own Page figures — the last 28 or 30 days, whatever the filter below.</p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="The Page, last 28 days">
          <KpiCard
            label="Followers"
            value={num(fb.followers)}
            k={{ value: fb.followers, prev: fb.followers - flow.net, delta: fb.followers - flow.net ? flow.net / (fb.followers - flow.net) : null, spark: followersLine }}
            note={`${flow.net >= 0 ? '+' : ''}${num(flow.net)} in 30 days · ${num(flow.follows)} followed, ${num(flow.unfollows)} left`}
          />
          <KpiCard
            label="Viewers · 28 days"
            value={w?.viewers != null ? compact(w.viewers) : '—'}
            k={w?.viewers != null ? { value: w.viewers, prev: pw?.viewers ?? null, delta: viewersDelta, spark: recent.filter(d => d.day >= cutoff(28)).map(d => d.viewers ?? 0) } : undefined}
            note="unique people who saw the Page or its posts"
            prevLabel="against the 28 days before"
          />
          <KpiCard
            label="Views · 28 days"
            value={w?.views != null ? compact(w.views) : '—'}
            k={w?.views != null ? { value: w.views, prev: pw?.views ?? null, delta: delta(w.views, pw?.views), spark: recent.filter(d => d.day >= cutoff(28)).map(d => d.views ?? 0) } : undefined}
            note={w?.views && w?.viewers ? `${(w.views / w.viewers).toFixed(1)} views per viewer` : 'every time content was shown'}
            prevLabel="against the 28 days before"
          />
          <KpiCard
            label="Engagements · 28 days"
            value={w?.engagements != null ? compact(w.engagements) : '—'}
            k={w?.engagements != null ? { value: w.engagements, prev: pw?.engagements ?? null, delta: delta(w.engagements, pw?.engagements), spark: [] } : undefined}
            note={w?.engagements && w?.viewers ? `${((w.engagements / w.viewers) * 100).toFixed(1)} per 100 viewers` : 'reactions, comments, shares, clicks'}
            prevLabel="against the 28 days before"
          />
          <KpiCard
            label="Typical post"
            value={compact(base.typical)}
            note={`median viewers, last 30 days · top quarter ${compact(base.p75)}+ · ${base.posts.length} posts`}
          />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-fb-daily">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-daily">
              Viewers, day by day
            </h2>
            <p className="v3-panel-note">Last 90 days · unique people each day, so days are never added together</p>
          </div>
          <SeriesChart
            unit="viewers"
            points={recent.map(d => ({
              key: d.day,
              label: shortDate(d.day),
              value: d.viewers,
              note: `${num(d.views ?? 0)} views · ${d.follows != null ? `+${num(d.follows)} followers` : ''}`,
            }))}
          />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-fb-months">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-months">
              Views by month
            </h2>
            <p className="v3-panel-note">{firstViews ? `Since ${longDate(firstViews)}, when Facebook started reporting views` : 'No views reported yet'}</p>
          </div>
          <SeriesChart kind="bars" unit="views" points={months} />
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-fb-followers">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-followers">
              Followers over time
            </h2>
            <p className="v3-panel-note">At the end of each month</p>
          </div>
          <SeriesChart unit="followers" points={followerMonths} />
        </section>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">What works</h2>
          <p className="v3-chapter-note">Your posts, judged against your typical post. The filter steers everything in this chapter.</p>
        </div>
        <div className="v3-span-12">
          <FbFilters days={days} type={type} />
        </div>

        <section className="v3-panel v3-span-12" aria-labelledby="t-fb-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-top">
              Top posts
            </h2>
            <p className="v3-panel-note">
              Ranked by viewers · {s.posts.length} posts, {s.read} with figures · typical {compact(s.typical)}
            </p>
          </div>
          <PostList posts={s.top} lift={s.lift} />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-fb-did">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-did">
              What people did
            </h2>
            <p className="v3-panel-note">Per 100 viewers, posts in view</p>
          </div>
          <div className="v3-attn">
            <div>
              <div className="v3-attn-v num">{per100(s.rates.share)}</div>
              <div className="v3-attn-l">shares</div>
              <div className="v3-attn-n">{num(s.totals.shares)} in all — what carries a post to new people</div>
            </div>
            <div>
              <div className="v3-attn-v num">{per100(s.rates.reaction)}</div>
              <div className="v3-attn-l">reactions</div>
              <div className="v3-attn-n">{num(s.totals.reactions)} in all</div>
            </div>
            <div>
              <div className="v3-attn-v num">{per100(s.rates.comment)}</div>
              <div className="v3-attn-l">comments</div>
              <div className="v3-attn-n">{num(s.totals.comments)} in all</div>
            </div>
            <div>
              <div className="v3-attn-v num">{compact(s.totals.views)}</div>
              <div className="v3-attn-l">post views</div>
              <div className="v3-attn-n">every showing of these posts, added up</div>
            </div>
          </div>
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-fb-fmt">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-fmt">
              What kind of post works
            </h2>
            {s.byType[0] ? <p className="v3-panel-note">{TYPE_LABEL[s.byType[0].type] ?? s.byType[0].type} reach the most people per post</p> : null}
          </div>
          <div className="v3-rows">
            {s.byType.map(t => (
              <div key={t.type} className="v3-row">
                <div className="v3-row-main">
                  <div className="v3-row-title">{TYPE_LABEL[t.type] ?? t.type}</div>
                  <div className="v3-row-sub">
                    {t.count} · {t.rate.toFixed(1)} engagements per 100 viewers
                  </div>
                </div>
                <div className="v3-row-num">{compact(t.typical)} typical</div>
                <div className="v3-row-bar">
                  <i style={{ ['--w' as string]: (t.typical / (s.byType[0]?.typical || 1)).toFixed(3) }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-fb-day">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-day">
              Best day to post
            </h2>
            <p className="v3-panel-note">Typical viewers by weekday · Malaysia time</p>
          </div>
          <div className="v3-rows">
            {s.byWeekday.map(d => {
              const top = Math.max(1, ...s.byWeekday.map(x => x.typical))
              return (
                <div key={d.day} className="v3-row">
                  <div className="v3-row-main">
                    <div className="v3-row-title">{d.day}</div>
                    <div className="v3-row-sub">
                      {d.count} post{d.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="v3-row-num">{d.count ? compact(d.typical) : '—'}</div>
                  <div className="v3-row-bar">
                    <i style={{ ['--w' as string]: (d.typical / top).toFixed(3) }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        <section className="v3-panel v3-span-6" aria-labelledby="t-fb-quiet">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-fb-quiet">
              Quietest posts
            </h2>
            <p className="v3-panel-note">
              Worth a look before making more of the same · {num(s.posts.reduce((x, p) => x + engagement(p), 0))} engagements across the window
            </p>
          </div>
          <PostList posts={s.read > 3 ? s.quiet : []} lift={s.lift} />
        </section>
      </div>
    </div>
  )
}
