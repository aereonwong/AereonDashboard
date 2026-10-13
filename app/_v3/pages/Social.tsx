import type { Social as S, SocialPost, PlatformFigures } from '@/lib/v3/social'
import SocialDaily from '../SocialDaily'
import SocialFilters from '../SocialFilters'
import { KpiCard } from '../summary/Panels'
import { compact, num, shortDate } from '../fmt'

// 👉 v3 Social — Instagram and Facebook together: where the audience is, how far the
// work travels on each, and the best posts across both. Maths in lib/v3/social.ts.
// Combined people-reached figures are PLATFORM TOTALS (someone on both counts twice);
// posts are ranked by lift over their own platform's typical post.

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const NAME = { ig: 'Instagram', fb: 'Facebook' } as const
const signed = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`
const ago = (iso: string | null) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}
const share = (a: number | null, b: number | null) => (a !== null && b !== null && a + b > 0 ? a / (a + b) : null)

function Split({ ig, fb }: { ig: number | null; fb: number | null }) {
  const s = share(ig, fb)
  if (s === null) return <span className="v3-soc-split empty" aria-hidden="true" />
  return (
    <span className="v3-soc-split" role="img" aria-label={`${Math.round(s * 100)}% Instagram, ${Math.round((1 - s) * 100)}% Facebook`}>
      <i className="ig" style={{ ['--w' as string]: s.toFixed(3) }} />
      <i className="fb" style={{ ['--w' as string]: (1 - s).toFixed(3) }} />
      <small>{Math.round(s * 100)}%</small>
    </span>
  )
}

function Compare({ s }: { s: S }) {
  const { ig, fb } = s
  const rate = (f: PlatformFigures) => (f.people && f.interactions !== null ? (f.interactions / f.people) * 100 : null)
  const rows: { label: string; note?: string; ig: string; fb: string; split?: [number | null, number | null] }[] = [
    { label: 'Followers', ig: num(ig.followers), fb: num(fb.followers), split: [ig.followers, fb.followers] },
    {
      label: 'Change, 30 days',
      note: 'followed less unfollowed',
      ig: ig.net30 !== null ? signed(ig.net30) : '—',
      fb: fb.net30 !== null ? signed(fb.net30) : '—',
    },
    {
      label: 'People reached',
      note: 'Instagram 30 days · Facebook 28 days',
      ig: ig.people !== null ? compact(ig.people) : '—',
      fb: fb.people !== null ? compact(fb.people) : '—',
      split: [s.igFresh ? ig.people : null, s.fbFresh ? fb.people : null],
    },
    { label: 'Views', note: 'every showing', ig: ig.views !== null ? compact(ig.views) : '—', fb: fb.views !== null ? compact(fb.views) : '—', split: [s.igFresh ? ig.views : null, s.fbFresh ? fb.views : null] },
    {
      label: 'Interactions',
      note: 'Facebook adds link clicks',
      ig: ig.interactions !== null ? compact(ig.interactions) : '—',
      fb: fb.interactions !== null ? compact(fb.interactions) : '—',
      split: [s.igFresh ? ig.interactions : null, s.fbFresh ? fb.interactions : null],
    },
    {
      label: 'Interactions per 100 reached',
      ig: rate(ig) !== null ? rate(ig)!.toFixed(1) : '—',
      fb: rate(fb) !== null ? rate(fb)!.toFixed(1) : '—',
    },
    { label: 'Typical post', note: `median people per post, ${s.days} days`, ig: ig.typical ? compact(ig.typical) : '—', fb: fb.typical ? compact(fb.typical) : '—' },
    { label: 'Posts a week', note: `${s.days} days`, ig: ig.perWeek.toFixed(1), fb: fb.perWeek.toFixed(1), split: [ig.posts, fb.posts] },
    { label: 'Last post', ig: ago(ig.lastPost), fb: ago(fb.lastPost) },
  ]
  return (
    <div className="v3-soc-table" role="table" aria-label="Instagram against Facebook">
      <div className="v3-soc-tr head" role="row">
        <span role="columnheader" />
        <span role="columnheader">
          <i className="v3-soc-dot ig" aria-hidden="true" />
          Instagram
        </span>
        <span role="columnheader">
          <i className="v3-soc-dot fb" aria-hidden="true" />
          Facebook
        </span>
        <span role="columnheader">Instagram share</span>
      </div>
      {rows.map(r => (
        <div key={r.label} className="v3-soc-tr" role="row">
          <span role="rowheader">
            {r.label}
            {r.note ? <small>{r.note}</small> : null}
          </span>
          <span role="cell" className="num">
            {r.ig}
          </span>
          <span role="cell" className="num">
            {r.fb}
          </span>
          <span role="cell">{r.split ? <Split ig={r.split[0]} fb={r.split[1]} /> : null}</span>
        </div>
      ))}
    </div>
  )
}

function PostList({ posts }: { posts: (SocialPost & { lift: number })[] }) {
  if (!posts.length) return <p className="v3-empty">No posts with reach figures in this window.</p>
  return (
    <div className="v3-fb-posts">
      {posts.map(p => {
        const body = (
          <>
            {p.thumb ? (
              // Instagram and Facebook CDN links expire; a broken one just shows the grey frame behind it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb} alt="" loading="lazy" />
            ) : (
              <span className="ph" aria-hidden="true" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="t">{p.title}</div>
              <div className="s">
                <span className={`v3-soc-tag ${p.platform}`}>{NAME[p.platform]}</span> {p.kind} · {shortDate(p.at)} · {p.interactions !== null ? `${num(p.interactions)} interactions` : 'interactions not read'}
              </div>
            </div>
            <div className="v">
              {compact(p.people ?? 0)}
              <small>
                {p.platform === 'ig' ? 'reached' : 'viewers'} · {p.lift >= 1 ? `${p.lift.toFixed(1)}×` : `${Math.round(p.lift * 100)}% of`} typical
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
  const platform = ['ig', 'fb'].includes(one(sp.p) ?? '') ? one(sp.p)! : ''
  const { ig, fb, total } = s

  if (!s.hasIg && !s.hasFb) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">Social</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">
            No Instagram or Facebook history yet. Refresh from the <a href="/instagram">Instagram</a> and <a href="/facebook">Facebook</a> pages.
          </p>
        </section>
      </div>
    )
  }

  const igShare = share(s.igFresh ? ig.people : null, s.fbFresh ? fb.people : null)
  const lede = [
    total.people !== null ? `${compact(total.people)} reached across both in the last month` : null,
    igShare !== null ? `${Math.round(igShare * 100)}% of it on Instagram` : null,
    `${num(total.followers)} followers in all`,
  ].filter(Boolean)
  const posts = platform ? s.ranked.filter(p => p.platform === platform) : s.ranked
  const kindTop = Math.max(1, ...s.kinds.map(k => k.typical))
  const weekTop = Math.max(1, ...s.weeks.map(w => w.ig + w.fb))
  const spark = s.daily.map(d => (d.ig ?? 0) + (d.fb ?? 0)).slice(-30)

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
          <h2 className="v3-chapter-title">Both platforms</h2>
          <p className="v3-chapter-note">
            Added together. People reached is a platform total — someone who follows or sees you on both counts twice.
            {s.hasFb && !s.fbFresh ? ' Facebook’s figures are over a week old, so they are left out of the totals until the next refresh.' : ''}
            {s.hasIg && !s.igFresh ? ' Instagram’s account figures are over a week old, so they are left out of the totals until the next refresh.' : ''}
          </p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="Both platforms, last month">
          <KpiCard
            label="Followers"
            value={num(total.followers)}
            note={`${total.net30 !== null ? `${signed(total.net30)} in 30 days · ` : ''}Instagram ${compact(ig.followers)} · Facebook ${compact(fb.followers)}`}
          />
          <KpiCard
            label="People reached"
            value={total.people !== null ? compact(total.people) : '—'}
            k={{ value: total.people ?? 0, prev: null, delta: null, spark }}
            note="Instagram 30 days + Facebook 28 days"
          />
          <KpiCard label="Views" value={total.views !== null ? compact(total.views) : '—'} note="every showing, both platforms" />
          <KpiCard
            label="Interactions"
            value={total.interactions !== null ? compact(total.interactions) : '—'}
            note="likes, comments, saves, shares · Facebook adds clicks"
          />
          <KpiCard
            label="Posting"
            value={`${total.perWeek.toFixed(1)}/wk`}
            note={`Instagram ${ig.perWeek.toFixed(1)} · Facebook ${fb.perWeek.toFixed(1)} · ${s.days} days · a cross-post counts on each`}
          />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-soc-vs">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-vs">
              Instagram against Facebook
            </h2>
            <a className="v3-panel-link" href="/instagram">
              Instagram
            </a>
            <a className="v3-panel-link" href="/facebook">
              Facebook
            </a>
          </div>
          <Compare s={s} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-soc-daily">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-daily">
              People reached, day by day
            </h2>
            <p className="v3-panel-note">Last 90 days · each platform&rsquo;s own daily count, stacked</p>
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
          <SocialFilters days={String(s.days)} platform={platform} />
        </div>

        <section className="v3-panel v3-span-12" aria-labelledby="t-soc-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-top">
              Best posts{platform ? `, ${NAME[platform as 'ig' | 'fb']}` : ', both platforms'}
            </h2>
            <p className="v3-panel-note">
              Ranked by how far each beat its platform&rsquo;s typical post · Instagram typical {ig.typical ? compact(ig.typical) : '—'}, Facebook{' '}
              {fb.typical ? compact(fb.typical) : '—'}
            </p>
          </div>
          <PostList posts={posts.slice(0, 10)} />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-soc-kind">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-soc-kind">
              What travels furthest
            </h2>
            <p className="v3-panel-note">Typical people per post, by platform and format · ignores the platform switch</p>
          </div>
          {s.kinds.length ? (
            <div className="v3-rows">
              {s.kinds.map(k => (
                <div key={`${k.platform}-${k.kind}`} className="v3-row">
                  <div className="v3-row-main">
                    <div className="v3-row-title">
                      <span className={`v3-soc-tag ${k.platform}`}>{NAME[k.platform]}</span> {k.kind}
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
          <div className="v3-soc-weeks" role="img" aria-label={`Posts per week, last 12 weeks: ${s.weeks.map(w => w.ig + w.fb).join(', ')}`}>
            {s.weeks.map(w => (
              <div key={w.start} className="col" title={`Week of ${shortDate(w.start)}: Instagram ${w.ig}, Facebook ${w.fb}`}>
                <div className="stack">
                  <i className="fb" style={{ ['--h' as string]: (w.fb / weekTop).toFixed(3) }} />
                  <i className="ig" style={{ ['--h' as string]: (w.ig / weekTop).toFixed(3) }} />
                </div>
                <b className="num">{w.ig + w.fb}</b>
                <small>{shortDate(w.start)}</small>
              </div>
            ))}
          </div>
          <div className="v3-legend">
            <span>
              <i className="v3-soc-dot ig" aria-hidden="true" />
              Instagram
            </span>
            <span>
              <i className="v3-soc-dot fb" aria-hidden="true" />
              Facebook
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
