import { PLATFORM, PLATFORM_NAME, isPlatform, type PlatformId } from '@/lib/v3/platforms'
import type { Social as S, SocialPost } from '@/lib/v3/social'
import SocialFilters from '../SocialFilters'
import ScopedPanel from '../ScopedPanel'
import { Compare, Dot, basisNote, FollowersChart, MonthsChart, PeopleChart, WeeksChart, names, signed, windowName } from '../SocialOverview'
import { KpiCard } from '../summary/Panels'
import { compact, num, shortDate } from '../fmt'

// 👉 v3 Social — every connected platform together: who follows, how far the work travels, what
// works where. Maths in lib/v3/social.ts; platforms in lib/v3/platforms.ts.
// One currency: VIEWS of the posts published in the window, read the same way on every platform.
// People reached is each platform's own unique count — added only as a platform total, only
// where measured. Posts are ranked by lift over their own platform's typical (median) post.

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function PostList({ posts }: { posts: (SocialPost & { lift: number })[] }) {
  if (!posts.length) return <p className="v3-empty">No posts with figures in this window.</p>
  return (
    <div className="v3-fb-posts">
      {posts.map(p => {
        const body = (
          <>
            {p.thumb ? (
              // Platform CDN links expire; a broken one just shows the grey frame behind it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="ph" aria-hidden="true" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="t">{p.title}</div>
              <div className="s">
                <span className="v3-soc-tag" data-p={p.platform}>
                  {PLATFORM_NAME[p.platform]}
                </span>{' '}
                {p.kind} · {shortDate(p.at)} · {p.interactions !== null ? `${num(p.interactions)} interactions` : 'interactions not read'}
                {p.views && p.interactions !== null ? ` · ${((p.interactions / p.views) * 100).toFixed(1)}%` : ''}
              </div>
            </div>
            <div className="v">
              {compact(p.views ?? 0)}
              <small>views · {p.lift >= 1 ? `${p.lift.toFixed(1)}×` : `${Math.round(p.lift * 100)}% of`} typical</small>
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
  const want = one(sp.p)
  const platform: PlatformId | '' = isPlatform(want) && s.ids.includes(want) ? want : ''
  const { total } = s
  const w = windowName(s.days)

  if (!s.ids.length) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">Social</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">
            No social history yet. Refresh from each platform&rsquo;s page:{' '}
            {(['ig', 'fb', 'tt'] as PlatformId[]).map((p, i) => (
              <span key={p}>
                {i ? ', ' : ''}
                <a href={PLATFORM[p].href}>{PLATFORM_NAME[p]}</a>
              </span>
            ))}
            .
          </p>
        </section>
      </div>
    )
  }

  const best = s.platforms.filter(f => f.views !== null).sort((a, b) => b.views! - a.views!)[0]
  const lede = [
    `${num(total.followers)} followers across ${names(s.ids)}`,
    total.net30 !== null ? `${signed(total.net30)} in 30 days` : null,
    total.views !== null ? `${compact(total.views)} views in the last ${w}${best && s.platforms.length > 1 ? `, most on ${PLATFORM_NAME[best.id]}` : ''}` : null,
  ].filter(Boolean)
  const inSlice = (p: { platform: PlatformId }) => !platform || p.platform === platform
  const posts = s.ranked.filter(inSlice)
  const kinds = s.kinds.filter(inSlice)
  const kindTop = Math.max(1, ...kinds.map(k => k.typical))
  const netNote = total.net30 !== null && total.netOf.length < s.ids.length ? ` (${names(total.netOf)})` : ''
  const unreadNote =
    (total.unread ? ` · ${total.unread} post${total.unread === 1 ? '' : 's'} not read yet` : '') + (total.partial.length ? ` · ${names(total.partial)} left out until read` : '')

  return (
    <div>
      <header className="v3-head">
        <div>
          <p className="v3-eyebrow">
            Social · {names(s.ids)} · Last {w}
          </p>
          <h1 className="v3-title">Social</h1>
          <p className="v3-lede">{lede.join(' — ')}.</p>
        </div>
      </header>

      <SocialFilters days={String(s.days)} platform={platform} ids={s.ids} count={posts.length} />

      <div className="v3-grid">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Every platform, side by side</h2>
          <p className="v3-chapter-note">
            Views and interactions are each platform&rsquo;s own count for the window — posts, Reels, Stories and ads — where it reports one; the typical post and the rankings read the posts published in it.
            Followers add up as a platform total — someone on two counts twice.
            {s.stale.length ? ` ${names(s.stale)}’s latest reading is over a week old.` : ''}
          </p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label={`Every platform, last ${w}`}>
          <KpiCard
            label="Followers"
            value={num(total.followers)}
            note={`${total.net30 !== null ? `${signed(total.net30)} in 30 days${netNote} · ` : ''}${s.platforms.map(f => `${PLATFORM_NAME[f.id]} ${compact(f.followers)}`).join(' · ')}`}
          />
          <KpiCard label="Views" value={total.views !== null ? compact(total.views) : '—'} note={`last ${w} · ${basisNote(s)}${unreadNote}`} />
          <KpiCard
            label="Engagement rate"
            value={total.rate !== null ? `${total.rate.toFixed(1)}%` : '—'}
            note={`${total.interactions !== null ? compact(total.interactions) : '—'} interactions per 100 views · ${s.platforms.map(f => `${PLATFORM_NAME[f.id]} ${f.rate !== null ? f.rate.toFixed(1) + '%' : '—'}`).join(' · ')}`}
          />
          <KpiCard label="Posting" value={`${total.perWeek.toFixed(1)}/wk`} note={`${s.platforms.map(f => `${PLATFORM_NAME[f.id]} ${f.perWeek.toFixed(1)}`).join(' · ')} · a cross-post counts on each`} />
          {total.peopleOf.length ? (
            <KpiCard
              label="People reached"
              value={total.people !== null ? compact(total.people) : '—'}
              note={`${s.platforms
                .filter(f => f.people)
                .map(f => `${PLATFORM_NAME[f.id]} ${f.people!.window} days`)
                .join(' + ')} · platform total${s.ids.length > total.peopleOf.length ? ` · ${names(s.ids.filter(p => !total.peopleOf.includes(p)))} don’t measure it` : ''}`}
            />
          ) : null}
        </section>

        <ScopedPanel id="soc-vs" span={12} title="Platform by platform" note={`Posts of the last ${w} · followers and people reached as of the latest reading`} scope="Timeline only">
          <Compare s={s} />
        </ScopedPanel>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Over time</h2>
          <p className="v3-chapter-note">Fixed spans, so the trend reads the same whatever the bar above says.</p>
        </div>
        <ScopedPanel id="soc-months" span={6} title="Views by posting month" note="Views so far of each month’s posts · last 12 months · the newest months are still climbing" scope="Account-wide · ignores filters">
          <MonthsChart s={s} />
        </ScopedPanel>
        <ScopedPanel id="soc-followers" span={6} title="Followers gained" note="Last 90 days · each line from its platform’s first reading, so growth compares directly" scope="Account-wide · ignores filters">
          <FollowersChart s={s} />
        </ScopedPanel>
        {s.ids.some(p => PLATFORM[p].people) ? (
          <ScopedPanel id="soc-people" span={6} title="People reached, day by day" note="Last 90 days · each platform’s own unique count, stacked as a platform total" scope="Account-wide · ignores filters">
            <PeopleChart s={s} />
          </ScopedPanel>
        ) : null}
        <ScopedPanel id="soc-weeks" span={6} title="Posting, week by week" note="Last 12 weeks, Monday to Sunday · a cross-post counts on each" scope="Account-wide · ignores filters">
          <WeeksChart s={s} />
        </ScopedPanel>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">What works where</h2>
          <p className="v3-chapter-note">Each post is judged against its own platform&rsquo;s typical post, so a TikTok and an Instagram Reel rank on the same footing.</p>
        </div>

        <ScopedPanel
          id="soc-top"
          span={12}
          title={`Best posts${platform ? `, ${PLATFORM_NAME[platform]}` : ', every platform'}`}
          note={`Ranked by views against the platform’s typical post · typical ${s.platforms
            .filter(f => !platform || f.id === platform)
            .map(f => `${PLATFORM_NAME[f.id]} ${f.typical ? compact(f.typical) : '—'}`)
            .join(', ')}`}
          scope="All filters"
        >
          <PostList posts={posts.slice(0, 10)} />
        </ScopedPanel>

        <ScopedPanel id="soc-kind" span={6} title="What travels furthest" note="Typical views per post, by platform and format · 2+ posts to count" scope="All filters">
          {kinds.length ? (
            <div className="v3-rows">
              {kinds.map(k => (
                <div key={`${k.platform}-${k.kind}`} className="v3-row" data-tip={`${PLATFORM_NAME[k.platform]} ${k.kind}\n${num(k.typical)} typical views · ${k.count} posts`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">
                      <span className="v3-soc-tag" data-p={k.platform}>
                        {PLATFORM_NAME[k.platform]}
                      </span>{' '}
                      {k.kind}
                    </div>
                    <div className="v3-row-sub">
                      {k.count} post{k.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="v3-row-num">{compact(k.typical)}</div>
                  <div className="v3-row-bar v3-soc-bar" data-p={k.platform}>
                    <i style={{ ['--w' as string]: (k.typical / kindTop).toFixed(3) }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="v3-empty">Not enough posts in this window.</p>
          )}
        </ScopedPanel>

        <ScopedPanel id="soc-rate" span={6} title="Who engages most" note="Interactions per 100 views, posts of the window · the bar is each platform’s share of views" scope="Timeline only">
          <div className="v3-rows">
            {s.platforms.map(f => (
              <div key={f.id} className="v3-row" data-tip={`${PLATFORM_NAME[f.id]}\n${f.rate !== null ? f.rate.toFixed(1) + '%' : '—'} engagement · ${f.views !== null ? num(f.views) : '—'} views`}>
                <div className="v3-row-main">
                  <div className="v3-row-title">
                    <Dot p={f.id} />
                    {PLATFORM_NAME[f.id]}
                  </div>
                  <div className="v3-row-sub">
                    {f.views !== null ? compact(f.views) : '—'} views · {f.interactions !== null ? compact(f.interactions) : '—'} interactions · {f.posts} posts
                  </div>
                </div>
                <div className="v3-row-num">{f.rate !== null ? `${f.rate.toFixed(1)}%` : '—'}</div>
                <div className="v3-row-bar v3-soc-bar" data-p={f.id}>
                  <i style={{ ['--w' as string]: total.views && f.views ? (f.views / total.views).toFixed(3) : '0' }} />
                </div>
              </div>
            ))}
          </div>
        </ScopedPanel>
      </div>
    </div>
  )
}
