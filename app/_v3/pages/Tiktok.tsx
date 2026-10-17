import { analyseTt, change, interactions, lengthOf, LENGTHS, type Tiktok as Tt, type TtPostRow } from '@/lib/tiktok'
import TtFilters, { TT_DEFAULT_DAYS } from '../TtFilters'
import SeriesChart, { type SeriesPoint } from '../SeriesChart'
import ScopedPanel from '../ScopedPanel'
import Refresh from '../Refresh'
import { KpiCard } from '../summary/Panels'
import { compact, num, longDate, shortDate } from '../fmt'

// 👉 v3 TikTok: is the account growing, and which videos travel.
//
// TikTok gives lifetime counts only, so two kinds of figure are kept apart:
//   · ACCOUNT figures (followers, total likes) — our own daily readings; growth starts the day
//     the first refresh ran. Above the filter bar, they ignore it.
//   · VIDEO figures (each public video's latest views/likes/comments/shares) — these follow
//     the bar. A video's views are "so far", so the newest ones are still climbing.
// "Typical" is the MEDIAN video, never the mean. There is no reach on TikTok's API.

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`
const signed = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`
const per1k = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1))
const title = (p: TtPostRow) => (p.title ?? '').split('\n')[0].trim() || 'Video'
const WINDOW_LABEL: Record<string, string> = { '30': 'last 30 days', '90': 'last 90 days', '365': 'last 12 months', all: 'all time' }
const DAY = 86_400_000

function VideoList({ posts, typical, now }: { posts: TtPostRow[]; typical: number; now: number }) {
  if (!posts.length) return <p className="v3-empty">No videos with figures in this slice.</p>
  return (
    <div className="v3-fb-posts">
      {posts.map(p => {
        const x = typical && p.views !== null ? p.views / typical : null
        const young = p.posted_at && now - Date.parse(p.posted_at) < 7 * DAY
        const body = (
          <>
            {p.cover_url ? (
              // TikTok cover links expire within days; a broken one just shows the grey frame behind it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="ph" aria-hidden="true" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="t">{title(p)}</div>
              <div className="s">
                {p.posted_at ? shortDate(p.posted_at) : '—'}
                {p.duration !== null ? ` · ${p.duration}s` : ''} · {num(p.likes ?? 0)} likes · {num(p.comments ?? 0)} comments · {num(p.shares ?? 0)} shares
                {young ? ' · still new, views climbing' : ''}
              </div>
            </div>
            <div className="v">
              {p.views !== null ? compact(p.views) : '—'}
              <small>views{x !== null && (x >= 1.5 || x <= 0.5) ? ` · ${x >= 1 ? `${x.toFixed(1)}×` : `${Math.round(x * 100)}% of`} typical` : ''}</small>
            </div>
          </>
        )
        return p.share_url ? (
          <a key={p.video_id} className="v3-fb-post" href={p.share_url} target="_blank" rel="noopener noreferrer">
            {body}
          </a>
        ) : (
          <div key={p.video_id} className="v3-fb-post">
            {body}
          </div>
        )
      })}
    </div>
  )
}

export default function Tiktok({ tt, sp }: { tt: Tt; sp: Params }) {
  const days = ['30', '90', '365', 'all'].includes(one(sp.days) ?? '') ? one(sp.days)! : TT_DEFAULT_DAYS
  const len = LENGTHS.some(l => l.id === one(sp.len)) ? one(sp.len)! : ''

  if (!tt.daily.length && !tt.posts.length) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">TikTok</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">
            No TikTok history yet. Run <code>supabase/tiktok.sql</code> once in Supabase, then fetch — or run <code>npm run tt:backfill</code> on the Mac to
            store every public video.
          </p>
          <Refresh label="Fetch my TikTok data" endpoint="/api/tiktok/refresh" />
        </section>
      </div>
    )
  }

  const now = Date.now()
  const base = analyseTt(tt.posts, 90, now)
  const s = analyseTt(len ? tt.posts.filter(p => lengthOf(p) === len) : tt.posts, days === 'all' ? 0 : Number(days), now)
  const latest = tt.daily.at(-1)
  const fol30 = change(tt.daily, 'followers', 30, now)
  const likes30 = change(tt.daily, 'likes', 30, now)
  const since = tt.daily[0]?.day
  const recent = tt.daily.filter(d => d.day >= new Date(now - 90 * DAY).toISOString().slice(0, 10))

  // Views of the videos posted each month (their lifetime views so far) — counts, so they add up.
  const byMonth = new Map<string, { views: number; n: number }>()
  for (const p of tt.posts) {
    if (!p.posted_at || p.views === null) continue
    const k = new Date(Date.parse(p.posted_at) + 8 * 3_600_000).toISOString().slice(0, 7)
    const m = byMonth.get(k) ?? { views: 0, n: 0 }
    byMonth.set(k, { views: m.views + p.views, n: m.n + 1 })
  }
  const months: SeriesPoint[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24)
    .map(([k, v]) => ({ key: k, label: monthLabel(k), value: v.views, note: `${v.n} video${v.n === 1 ? '' : 's'} posted` }))

  const verdict = [
    `${compact(tt.followers)} followers`,
    fol30 ? `${signed(fol30.net)} in 30 days` : null,
    s.read ? `typical video ${compact(s.typical)} views (${WINDOW_LABEL[days]})` : null,
    s.hits.length ? `${s.hits.length} video${s.hits.length === 1 ? '' : 's'} beat twice that` : null,
  ].filter(Boolean)
  const dayTop = Math.max(1, ...s.byWeekday.map(d => d.typical))
  const sliceName = `${WINDOW_LABEL[days]}${len ? ` · ${LENGTHS.find(l => l.id === len)!.label}` : ''}`

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">TikTok</h1>
          <p className="v3-lede">
            {verdict.join(', ')}. {tt.username ? `@${tt.username}` : ''}
            {tt.updated ? ` · updated ${longDate(tt.updated)}` : ''}
          </p>
        </div>
        <Refresh label="Refresh from TikTok" endpoint="/api/tiktok/refresh" />
      </header>

      <div className="v3-grid">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Growth</h2>
          <p className="v3-chapter-note">
            The account as TikTok counts it today. TikTok keeps no history, so the trend is our own daily reading{since ? `, kept since ${longDate(since)}` : ''}.
          </p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="The account">
          <KpiCard
            label="Followers"
            value={num(tt.followers)}
            k={fol30 ? { value: tt.followers, prev: tt.followers - fol30.net, delta: tt.followers - fol30.net ? fol30.net / (tt.followers - fol30.net) : null, spark: recent.map(d => d.followers ?? 0) } : undefined}
            note={fol30 ? `${signed(fol30.net)} in 30 days` : 'change shows once 30 days of readings are kept'}
            prevLabel="against 30 days ago"
          />
          <KpiCard
            label="Likes, all videos"
            value={latest?.likes != null ? compact(latest.likes) : '—'}
            note={likes30 ? `${signed(likes30.net)} in 30 days` : 'every like the account has ever had'}
          />
          <KpiCard
            label="Videos"
            value={latest?.video_count != null ? num(latest.video_count) : '—'}
            note={`${num(tt.posts.length)} public ones stored · ${base.postsPerWeek.toFixed(1)} a week lately`}
          />
          <KpiCard
            label="Typical video"
            value={compact(base.typical)}
            note={`median views, posted in the last 90 days · top quarter ${compact(base.p75)}+ · ${base.read} videos`}
          />
          <KpiCard
            label="Last post"
            value={base.daysSinceLast === null ? '—' : base.daysSinceLast === 0 ? 'Today' : `${base.daysSinceLast}d ago`}
            note={latest?.following != null ? `following ${num(latest.following)}` : ' '}
          />
        </section>

        <ScopedPanel id="tt-followers" span={6} title="Followers, day by day" note="Our daily reading · last 90 days" scope="Account-wide · ignores filters">
          <SeriesChart unit="followers" points={recent.map(d => ({ key: d.day, label: shortDate(d.day), value: d.followers, note: d.likes != null ? `${compact(d.likes)} likes in all` : undefined }))} />
        </ScopedPanel>
        <ScopedPanel id="tt-months" span={6} title="Views by posting month" note="Views so far of the videos posted each month · last 24 months" scope="Account-wide · ignores filters">
          <SeriesChart kind="bars" unit="views" points={months} />
        </ScopedPanel>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">What works</h2>
          <p className="v3-chapter-note">Your public videos, judged against your typical video. The bar steers everything in this chapter.</p>
        </div>
        <div className="v3-span-12">
          <TtFilters days={days} len={len} count={s.posts.length} />
        </div>

        <ScopedPanel
          id="tt-top"
          span={12}
          title="Top videos"
          note={`Ranked by views · ${sliceName} · ${s.read} videos · typical ${compact(s.typical)}`}
          scope="All filters"
        >
          <VideoList posts={s.top} typical={s.typical} now={now} />
        </ScopedPanel>

        <ScopedPanel id="tt-did" span={6} title="What people did" note={`Per 1,000 views · ${sliceName}`} scope="All filters">
          <div className="v3-attn">
            <div>
              <div className="v3-attn-v num">{per1k(s.rates.share)}</div>
              <div className="v3-attn-l">shares</div>
              <div className="v3-attn-n">{num(s.totals.shares)} in all — what carries a video to new people</div>
            </div>
            <div>
              <div className="v3-attn-v num">{per1k(s.rates.like)}</div>
              <div className="v3-attn-l">likes</div>
              <div className="v3-attn-n">{num(s.totals.likes)} in all</div>
            </div>
            <div>
              <div className="v3-attn-v num">{per1k(s.rates.comment)}</div>
              <div className="v3-attn-l">comments</div>
              <div className="v3-attn-n">{num(s.totals.comments)} in all</div>
            </div>
            <div>
              <div className="v3-attn-v num">{compact(s.totals.views)}</div>
              <div className="v3-attn-l">views</div>
              <div className="v3-attn-n">every play of these videos, added up</div>
            </div>
          </div>
        </ScopedPanel>

        <ScopedPanel id="tt-len" span={6} title="Which length works" note={s.byLength[0] ? `Typical views by video length · ${WINDOW_LABEL[days]}` : undefined} scope="Ignores length">
          {(() => {
            // This panel IS the length filter: it shows every length, the chosen one marked.
            const all = analyseTt(tt.posts, days === 'all' ? 0 : Number(days), now)
            const top = Math.max(1, ...all.byLength.map(l => l.typical))
            return all.byLength.length ? (
              <div className="v3-rows">
                {all.byLength.map(l => (
                  <div key={l.id} className="v3-row" aria-current={len === l.id ? 'true' : undefined}>
                    <div className="v3-row-main">
                      <div className="v3-row-title">{l.label}</div>
                      <div className="v3-row-sub">
                        {l.count} video{l.count === 1 ? '' : 's'} · {per1k(l.rate)} likes, comments & shares per 1,000 views
                      </div>
                    </div>
                    <div className="v3-row-num">{compact(l.typical)} typical</div>
                    <div className="v3-row-bar">
                      <i style={{ ['--w' as string]: (l.typical / top).toFixed(3) }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="v3-empty">No videos in this window.</p>
            )
          })()}
        </ScopedPanel>

        <ScopedPanel id="tt-day" span={6} title="Best day to post" note="Typical views by weekday · Malaysia time" scope="All filters">
          <div className="v3-rows">
            {s.byWeekday.map(d => (
              <div key={d.day} className="v3-row">
                <div className="v3-row-main">
                  <div className="v3-row-title">{d.day}</div>
                  <div className="v3-row-sub">
                    {d.count} video{d.count === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="v3-row-num">{d.count ? compact(d.typical) : '—'}</div>
                <div className="v3-row-bar">
                  <i style={{ ['--w' as string]: (d.typical / dayTop).toFixed(3) }} />
                </div>
              </div>
            ))}
          </div>
        </ScopedPanel>
        <ScopedPanel
          id="tt-quiet"
          span={6}
          title="Quietest videos"
          note={`Worth a look before making more of the same · ${num(s.posts.reduce((x, p) => x + interactions(p), 0))} likes, comments & shares in the slice`}
          scope="All filters"
        >
          <VideoList posts={s.read > 3 ? s.quiet : []} typical={s.typical} now={now} />
        </ScopedPanel>
      </div>
    </div>
  )
}
