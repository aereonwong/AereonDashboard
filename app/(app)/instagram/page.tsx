// 👉 Instagram — how your posts are actually performing, read from the newest
// snapshot in `ig_snapshots` (fetched through Composio). Engagement is measured
// against REACH, the accounts that really saw a post, not your follower count.
import { latestSnapshot, latestAccount, readAudienceView, analyse, type IgPost } from '@/lib/instagram'
import Stat from '@/app/_components/Stat'
import AreaChart from '@/app/_components/AreaChart'
import RowBars from '@/app/_components/RowBars'
import Donut from '@/app/_components/Donut'
import Icon from '@/app/_components/Icon'
import RefreshButton from '@/app/_components/RefreshButton'

import V3Instagram from '@/app/_v3/pages/Instagram'
import { readVersion } from '@/lib/v3/version'
import { readAudience } from '@/lib/v3/audience'

export const dynamic = 'force-dynamic'

const n = (v: number | undefined) => (v === undefined ? '—' : Math.round(v).toLocaleString('en-MY'))
const short = (p: IgPost) => (p.caption ? p.caption.slice(0, 42) + (p.caption.length > 42 ? '…' : '') : p.type)
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

export default async function Instagram({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { version } = await readVersion()
  if (version === 'v3') {
    const [audience, sp] = await Promise.all([readAudience(), searchParams])
    return <V3Instagram audience={audience} sp={sp} />
  }
  const [snap, account] = await Promise.all([latestSnapshot(), latestAccount()])

  if (!snap) {
    return (
      <>
        <h1 className="ph">Instagram 📸</h1>
        <p className="cap">Reach, engagement and what's working — from your own account insights.</p>
        <div className="banner info">
          No snapshot yet. Press refresh to pull your latest posts, or run <code>npm run ig:refresh</code> on your Mac.
        </div>
        <RefreshButton endpoint="/api/instagram/refresh" label="Fetch my Instagram data" />
      </>
    )
  }

  const s = analyse(snap)
  const ig = account ? readAudienceView(account, snap.profile.followers_count ?? 0) : null
  const net = ig?.follows != null && ig?.unfollows != null ? ig.follows - ig.unfollows : null
  const p = snap.profile
  const best = s.byType[0]
  const oldest = [...snap.posts].map(p => p.timestamp).sort()[0]?.slice(0, 10)
  const bestDay = s.byWeekday.filter(d => d.count >= 2)[0] ?? s.byWeekday[0]

  return (
    <>
      <h1 className="ph">Instagram 📸</h1>
      <p className="cap">
        @{snap.username || 'you'} · {s.window.count > 0 ? `last ${s.window.days} days` : `last ${s.posts.length} posts`} ·
        snapshot {ago(snap.captured_at)}
      </p>

      <div className="grid">
        <Stat label="Followers" value={n(p.followers_count)} icon="users" />
        <Stat label="Posts in window" value={String(s.posts.length)} icon="camera" />
        <Stat label="Views" value={n(s.totals.views)} icon="eye" />
        <Stat label="Accounts reached" value={n(s.totals.reach)} icon="trend" />
        <Stat label="Engagement rate" value={`${s.engagementRate.toFixed(1)}%`} icon="heart" />
        <Stat label="Reach per post" value={n(s.reachPerPost)} icon="share" />
      </div>

      <p className="metahint">
        A typical post reaches <b>{s.reachVsFollowers.toFixed(0)}%</b> of your followers ·{' '}
        you post about <b>{s.postsPerWeek.toFixed(1)}×</b> a week · last post <b>{s.daysSinceLastPost} day{s.daysSinceLastPost === 1 ? '' : 's'} ago</b> ·{' '}
        engagement = likes + comments + saves + shares ÷ accounts reached.
      </p>

      {ig ? (
        <div className="chart-card">
          <h2><Icon name="users" /> The whole account, last 30 days</h2>
          <p className="sub">From Instagram&apos;s account insights — every post, Reel and story combined</p>
          <div className="grid">
            <Stat label="Accounts reached" value={n(ig.totals.reach)} icon="trend" />
            <Stat label="New people" value={ig.newPeoplePct !== null ? `${Math.round(ig.newPeoplePct)}%` : '—'} icon="share" />
            <Stat label="Followers gained (net)" value={net !== null ? `${net >= 0 ? '+' : ''}${n(net)}` : '—'} icon="users" />
            <Stat label="Profile visits" value={n(ig.totals.profile_views)} icon="eye" />
          </div>
          <p className="metahint">
            Typical post (median) reaches <b>{n(s.baseline.median)}</b>; the top quarter clear <b>{n(s.baseline.p75)}</b> ·{' '}
            per 100 reached: <b>{s.rates.share.toFixed(1)}</b> shares, <b>{s.rates.save.toFixed(1)}</b> saves
            {s.watch ? <> · Reels hold <b>{s.watch.avgSec.toFixed(1)}s</b> on average</> : null}
            {ig.coreAgePct !== null ? <> · <b>{Math.round(ig.coreAgePct)}%</b> of followers are 25–44</> : null}
            {ig.homePct !== null ? <>, <b>{Math.round(ig.homePct)}%</b> in Malaysia</> : null}.
          </p>
        </div>
      ) : null}

      <div className="chart-card">
        <h2><Icon name="trend" /> Reach by week</h2>
        <p className="sub">
          Last 6 weeks · this snapshot holds your {snap.posts.length} most recent posts
          {oldest ? `, back to ${oldest}` : ''} — earlier weeks read as empty because they are not in it
        </p>
        <AreaChart
          points={s.weekly.map(w => ({
            label: w.label,
            value: w.reach,
            sub: `${w.posts} post${w.posts === 1 ? '' : 's'}`,
          }))}
          suffix=" reached"
          caption="hover the line to read any week"
        />
      </div>

      <div className="split">
        <div className="chart-card">
          <h2><Icon name="camera" /> What format works</h2>
          <p className="sub">
            {best ? `${best.type} reaches the most: ${n(best.avgReach)} per post` : 'Not enough data yet'}
          </p>
          <Donut
            slices={s.byType.map(t => ({ label: `${t.type} · ${t.count}`, value: Math.round(t.avgReach) }))}
            centerLabel="average reach per post"
          />
        </div>

        <div className="chart-card">
          <h2><Icon name="calendar" /> Best day to post</h2>
          <p className="sub">
            {bestDay ? `${bestDay.day} posts reach ${n(bestDay.avgReach)} on average` : 'Not enough data yet'}
          </p>
          <RowBars
            rows={s.byWeekday.map(d => ({
              name: d.day,
              value: d.avgReach,
              right: `${n(d.avgReach)} · ${d.count} post${d.count === 1 ? '' : 's'}`,
            }))}
          />
        </div>
      </div>

      <div className="chart-card">
        <h2><Icon name="sparkle" /> Top posts</h2>
        <p className="sub">By accounts reached</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Post</th>
              <th>Date</th>
              <th>Type</th>
              <th>Reach</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Saves</th>
            </tr>
          </thead>
          <tbody>
            {s.top.map(post => (
              <tr key={post.id}>
                <td data-label="Post">
                  {post.permalink ? (
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer">{short(post)}</a>
                  ) : (
                    short(post)
                  )}
                </td>
                <td data-label="Date">{post.timestamp.slice(0, 10)}</td>
                <td data-label="Type"><span className="pill">{post.type}</span></td>
                <td data-label="Reach">{n(post.reach)}</td>
                <td data-label="Views">{n(post.views)}</td>
                <td data-label="Likes">{n(post.likes)}</td>
                <td data-label="Comments">{n(post.comments)}</td>
                <td data-label="Shares">{n(post.shares)}</td>
                <td data-label="Saves">{n(post.saved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chart-card">
        <h2><Icon name="clock" /> Quietest posts</h2>
        <p className="sub">Lowest reach in this window — worth asking what was different</p>
        <RowBars
          rows={s.quiet.map(post => ({
            name: short(post),
            value: post.reach ?? 0,
            right: `${n(post.reach)} reach · ${post.timestamp.slice(0, 10)}`,
          }))}
        />
      </div>

      <RefreshButton endpoint="/api/instagram/refresh" />
    </>
  )
}
