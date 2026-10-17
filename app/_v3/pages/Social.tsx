import { PLATFORM_NAME, scoreOf, type Social as S, type SocialPost, type Platform } from '@/lib/v3/social'
import SocialDaily from '../SocialDaily'
import SocialFilters from '../SocialFilters'
import ScopedPanel from '../ScopedPanel'
import { Compare, FollowersChart, MonthsChart, shown } from '../SocialOverview'
import { KpiCard } from '../summary/Panels'
import { compact, num, shortDate } from '../fmt'

// 👉 v3 Social — Instagram, Facebook and TikTok together: where the audience is, how far the
// work travels on each, and the best posts across all three. Maths in lib/v3/social.ts.
// Combined people-reached figures are PLATFORM TOTALS (someone on two counts twice) and cover
// Instagram + Facebook only — TikTok reports no reach. Posts are ranked by lift over their own
// platform's typical post (people reached; TikTok views).

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const signed = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`
const ALL: Platform[] = ['ig', 'fb', 'tt']
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''))

function PostList({ posts }: { posts: (SocialPost & { lift: number })[] }) {
  if (!posts.length) return <p className="v3-empty">No posts with figures in this window.</p>
  return (
    <div className="v3-fb-posts">
      {posts.map(p => {
        const body = (
          <>
            {p.thumb ? (
              // Instagram, Facebook and TikTok CDN links expire; a broken one just shows the grey frame behind it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="ph" aria-hidden="true" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="t">{p.title}</div>
              <div className="s">
                <span className={`v3-soc-tag ${p.platform}`}>{PLATFORM_NAME[p.platform]}</span> {p.kind} · {shortDate(p.at)} ·{' '}
                {p.interactions !== null ? `${num(p.interactions)} interactions` : 'interactions not read'}
              </div>
            </div>
            <div className="v">
              {compact(scoreOf(p) ?? 0)}
              <small>
                {p.platform === 'ig' ? 'reached' : p.platform === 'fb' ? 'viewers' : 'views'} · {p.lift >= 1 ? `${p.lift.toFixed(1)}×` : `${Math.round(p.lift * 100)}% of`} typical
              </small>
            </div>
          </>
        )
        // Only plain https links are followed — a stored value is never trusted as a URL scheme.
        return p.permalink?.startsWith('https://') ? (
          <a key={`${p.platform}-${p.id}`} className="v3-fb-post" href={p.permalink} target="_blank" rel="noopener noreferrer">
            {body}
          </a>
        ) : (
          <div key={`${p.platform}-${p.id}`} className="v3-fb-post">
            {body}
          </div>
        )
      })}
    </div>
  )
}

export default function Social({ s, sp }: { s: S; sp: Params }) {
  const platform = ALL.includes(one(sp.p) as Platform) ? (one(sp.p) as Platform) : ''
  const { total } = s
  const ps = shown(s)
  const names = ps.map(p => PLATFORM_NAME[p])

  if (!s.hasIg && !s.hasFb && !s.hasTt) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">Social</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">
            No social history yet. Refresh from the <a href="/instagram">Instagram</a>, <a href="/facebook">Facebook</a> and <a href="/tiktok">TikTok</a> pages.
          </p>
        </section>
      </div>
    )
  }

  const stale = [
    s.hasIg && !s.igFresh ? 'Instagram' : null,
    s.hasFb && !s.fbFresh ? 'Facebook' : null,
    s.hasTt && !s.ttFresh ? 'TikTok' : null,
  ].filter(Boolean) as string[]
  const lede = [
    `${num(total.followers)} followers across ${and(names)}`,
    total.net30 !== null ? `${signed(total.net30)} in 30 days` : null,
    total.views !== null ? `${compact(total.views)} views in the last month` : null,
  ].filter(Boolean)
  const posts = platform ? s.ranked.filter(p => p.platform === platform) : s.ranked
  const kindTop = Math.max(1, ...s.kinds.map(k => k.typical))
  const weekTop = Math.max(1, ...s.weeks.map(w => w.ig + w.fb + w.tt))
  const spark = s.daily.map(d => (d.ig ?? 0) + (d.fb ?? 0)).slice(-30)
  const netNote = total.net30 !== null && total.netOf.length < ps.length ? ` (${and(total.netOf.map(p => PLATFORM_NAME[p]))} only)` : ''

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Social</h1>
          <p className="v3-lede">{lede.join(', ')}.</p>
        </div>
      </header>

      <div className="v3-grid">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">All platforms</h2>
          <p className="v3-chapter-note">
            Added together. Followers and people reached are platform totals — someone who follows or sees you on two counts twice.
            {stale.length ? ` ${and(stale)}’s figures are over a week old, so they are left out of the totals until the next refresh.` : ''}
          </p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="All platforms, last month">
          <KpiCard
            label="Followers"
            value={num(total.followers)}
            note={`${total.net30 !== null ? `${signed(total.net30)} in 30 days${netNote} · ` : ''}${ps.map(p => `${PLATFORM_NAME[p]} ${compact(s[p].followers)}`).join(' · ')}`}
          />
          <KpiCard
            label="People reached"
            value={total.people !== null ? compact(total.people) : '—'}
            k={{ value: total.people ?? 0, prev: null, delta: null, spark }}
            note="Instagram 30 days + Facebook 28 days · TikTok reports no reach"
          />
          <KpiCard label="Views" value={total.views !== null ? compact(total.views) : '—'} note={`every showing, last month${s.hasTt ? ' · TikTok: videos posted in it' : ''}`} />
          <KpiCard
            label="Interactions"
            value={total.interactions !== null ? compact(total.interactions) : '—'}
            note="likes, comments, saves, shares · Facebook adds clicks"
          />
          <KpiCard
            label="Posting"
            value={`${total.perWeek.toFixed(1)}/wk`}
            note={`${ps.map(p => `${PLATFORM_NAME[p]} ${s[p].perWeek.toFixed(1)}`).join(' · ')} · ${s.days} days · a cross-post counts on each`}
          />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-soc-vs">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-vs">
              Platform by platform
            </h2>
            {ps.map(p => (
              <a key={p} className="v3-panel-link" href={p === 'ig' ? '/instagram' : p === 'fb' ? '/facebook' : '/tiktok'}>
                {PLATFORM_NAME[p]}
              </a>
            ))}
          </div>
          <Compare s={s} />
        </section>

        <ScopedPanel id="soc-months" span={6} title="Views by posting month" note="Views so far of what was posted each month · last 12 months · the newest month is still climbing" scope="Account-wide · ignores filters">
          <MonthsChart s={s} />
        </ScopedPanel>
        <ScopedPanel id="soc-followers" span={6} title="Followers" note="Last 90 days · each line starts when its history does" scope="Account-wide · ignores filters">
          <FollowersChart s={s} />
        </ScopedPanel>

        <section className="v3-panel v3-span-12" aria-labelledby="t-soc-daily">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-daily">
              People reached, day by day
            </h2>
            <p className="v3-panel-note">Last 90 days · Instagram and Facebook&rsquo;s own daily counts, stacked · TikTok reports no reach</p>
          </div>
          <SocialDaily days={s.daily} />
          <div className="v3-legend">
            <span>
              <i className="v3-soc-dot ig" aria-hidden="true" />
              Instagram reach
            </span>
            <span>
              <i className="v3-soc-dot fb" aria-hidden="true" />
              Facebook viewers
            </span>
          </div>
        </section>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">What works where</h2>
          <p className="v3-chapter-note">Posts of the window below. Each post is judged against its own platform&rsquo;s typical post.</p>
        </div>
        <div className="v3-span-12">
          <SocialFilters days={String(s.days)} platform={platform} tiktok={s.hasTt} />
        </div>

        <section className="v3-panel v3-span-12" aria-labelledby="t-soc-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-top">
              Best posts{platform ? `, ${PLATFORM_NAME[platform]}` : ', every platform'}
            </h2>
            <p className="v3-panel-note">
              Ranked by how far each beat its platform&rsquo;s typical post · typical {ps.map(p => `${PLATFORM_NAME[p]} ${s[p].typical ? compact(s[p].typical) : '—'}`).join(', ')}
            </p>
          </div>
          <PostList posts={posts.slice(0, 10)} />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-soc-kind">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-kind">
              What travels furthest
            </h2>
            <p className="v3-panel-note">Typical per post, by platform and format · people reached (TikTok: views) · ignores the platform switch</p>
          </div>
          {s.kinds.length ? (
            <div className="v3-rows">
              {s.kinds.map(k => (
                <div key={`${k.platform}-${k.kind}`} className="v3-row">
                  <div className="v3-row-main">
                    <div className="v3-row-title">
                      <span className={`v3-soc-tag ${k.platform}`}>{PLATFORM_NAME[k.platform]}</span> {k.kind}
                    </div>
                    <div className="v3-row-sub">
                      {k.count} post{k.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="v3-row-num">{compact(k.typical)}</div>
                  <div className={`v3-row-bar v3-soc-bar ${k.platform}`}>
                    <i style={{ ['--w' as string]: (k.typical / kindTop).toFixed(3) }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="v3-empty">Not enough posts in this window.</p>
          )}
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-soc-weeks">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-weeks">
              Posting, week by week
            </h2>
            <p className="v3-panel-note">Last 12 weeks, Monday to Sunday · a cross-post counts on each</p>
          </div>
          <div className="v3-soc-weeks" role="img" aria-label={`Posts per week, last 12 weeks: ${s.weeks.map(w => w.ig + w.fb + w.tt).join(', ')}`}>
            {s.weeks.map(w => {
              const n = w.ig + w.fb + w.tt
              return (
                <div key={w.start} className="col" data-tip={`Week of ${shortDate(w.start)}\n${n} post${n === 1 ? '' : 's'}\n${ps.map(p => `${PLATFORM_NAME[p]} ${w[p]}`).join(' · ')}`}>
                  <div className="stack">
                    {ps.includes('tt') ? <i className="tt" style={{ ['--h' as string]: (w.tt / weekTop).toFixed(3) }} /> : null}
                    <i className="fb" style={{ ['--h' as string]: (w.fb / weekTop).toFixed(3) }} />
                    <i className="ig" style={{ ['--h' as string]: (w.ig / weekTop).toFixed(3) }} />
                  </div>
                  <b className="num">{n}</b>
                  <small>{shortDate(w.start)}</small>
                </div>
              )
            })}
          </div>
          <div className="v3-legend">
            {ps.map(p => (
              <span key={p}>
                <i className={`v3-soc-dot ${p}`} aria-hidden="true" />
                {PLATFORM_NAME[p]}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
