import type { Rec } from '@/lib/records'
import { buildStudio } from '@/lib/v3/studio'
import { withParam, type Filters } from '@/lib/v3/filters'
import type { Audience } from '@/lib/v3/audience'
import FilterBar from '../FilterBar'
import PaceChart from './PaceChart'
import Strip from './Strip'
import Receivables from './Receivables'
import { ClientRiskCard, ReachAndWork } from './Insights'
import { clientRisk, reachVsWork, postReach } from '@/lib/v3/insights'
import type { MetricRow } from '@/lib/v3/ig-insights'
import { Spark } from '../summary/Panels'
import { rmFull, pct, compact, num, shortDate } from '../fmt'
import { analyseFb, followerFlow, type Facebook } from '@/lib/facebook'
import { analyseTt, change, type Tiktok } from '@/lib/tiktok'

// 👉 Dashboard v3 — the creator studio, led by the three questions in PRODUCT.md.
// The daily pulse: deeper money analysis lives on Invoice Summary.

export default function Dashboard({
  rows,
  filters,
  audience,
  metrics = [],
  demo = false,
  fb,
  tt,
}: {
  rows: Rec[]
  filters: Filters
  audience: Audience
  metrics?: MetricRow[] // latest stored reading per post — reach history past the newest 40 posts
  demo?: boolean // demo invoices are invented: never set them against real Instagram reach
  fb?: Facebook // the Facebook Page's stored history — empty until the first refresh
  tt?: Tiktok // TikTok's stored history — empty until the first refresh
}) {
  const s = buildStudio(rows, filters)
  const risk = clientRisk(rows, filters, s.today)
  const rvw = reachVsWork(rows, filters, postReach(audience.snap?.posts ?? [], metrics), s.today)
  const { stats } = audience
  const up = (s.pacePct ?? 0) >= 0
  // The last 30 calendar days by date — a missed refresh leaves a gap, never stretches the window.
  const since30 = new Date(Date.parse(`${s.today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10)
  const reachLine = audience.daily.filter(d => d.day >= since30 && d.reach !== undefined).map(d => d.reach!)
  const reach30 = audience.view?.totals.reach ?? 0
  const engaged30 = audience.view?.totals.accounts_engaged
  const engagedPct = reach30 && engaged30 ? (engaged30 / reach30) * 100 : null
  const postWindow = stats?.window.count ? 'last 30 days' : `last ${stats?.posts.length ?? 0} posts`
  const newPct = audience.view?.newPeoplePct ?? null
  const netFollows =
    audience.view?.follows != null && audience.view?.unfollows != null ? audience.view.follows - audience.view.unfollows : null
  const trackLine =
    s.pacePct === null
      ? `No ${s.year - 1} invoices to compare against.`
      : `${up ? 'Ahead of' : 'Behind'} ${s.year - 1} by ${rmFull(Math.abs(s.ytd - s.lastYtd))} at this point in the year.`
  // Facebook beside Instagram. People who follow or see both are counted on each, so
  // combined figures are labelled as platform totals, never as unique people.
  const hasFb = !!fb && (fb.daily.length > 0 || fb.posts.length > 0)
  // Combined figures need BOTH platforms' current windows; otherwise a missing one would read as zero.
  const fbFresh = !!fb?.window && fb.window.until >= new Date(Date.parse(`${s.today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
  const both = hasFb && fbFresh && reach30 > 0 && netFollows !== null
  const fbFlow = hasFb ? followerFlow(fb!.daily, 30) : null
  const fbStats = hasFb ? analyseFb(fb!.posts, 30) : null
  const fbViewers = fb?.window?.viewers ?? null
  const fbEngPer100 = fb?.window?.engagements && fbViewers ? (fb.window.engagements / fbViewers) * 100 : null
  // TikTok has no reach, so it joins the follower and posting totals only. Its 30-day change
  // comes from our own daily readings and stays null until they reach back 30 days.
  const hasTt = !!tt && tt.daily.length > 0
  const ttFresh = hasTt && Date.now() - Date.parse(`${tt!.daily.at(-1)!.day}T00:00:00Z`) < 8 * 86_400_000
  const ttStats = hasTt ? analyseTt(tt!.posts, 30) : null
  const tt90 = hasTt ? analyseTt(tt!.posts, 90) : null
  const ttNet = hasTt ? change(tt!.daily, 'followers', 30) : null
  const ttFollowers = ttFresh ? tt!.followers : 0
  const allFollowers = audience.followers + (hasFb ? fb!.followers : 0) + ttFollowers
  // The combined change needs every counted platform's change, or it would read low.
  const allNet = netFollows !== null && fbFlow && (!ttFresh || ttNet) ? netFollows + fbFlow.net + (ttFresh ? ttNet!.net : 0) : null
  const allReach = reach30 + (fbViewers ?? 0)
  const filterNote = [filters.client, filters.kind].filter(Boolean).join(' · ')

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">{filterNote ? `${s.year} · ${filterNote}` : `${s.year} so far`}</h1>
          <p className="v3-lede">
            {rmFull(s.ytd)} invoiced this year — {trackLine}
          </p>
        </div>
      </header>

      <FilterBar filters={filters} clients={s.allClients} />

      {/* ---------------- The first viewport: the key figures ---------------- */}

      <section className="v3-hero v3-kpis" aria-label="Key figures">
          <a className="v3-kpi" href="#on-track">
            <div className="v3-kpi-label">Invoiced this year</div>
            <div className="v3-kpi-value">
              {rmFull(s.ytd)}
              {s.pacePct !== null ? <span className={`v3-delta ${up ? 'up' : 'down'}`}>{pct(s.pacePct)}</span> : null}
            </div>
            <div className="v3-kpi-note">vs {rmFull(s.lastYtd)} at this point in {s.year - 1}</div>
          </a>
          <a className="v3-kpi" href="#on-track">
            <div className="v3-kpi-label">Projected for {s.year}</div>
            <div className="v3-kpi-value">
              {rmFull(s.projection)}
              {s.lastFull ? (
                <span className={`v3-delta ${s.projection >= s.lastFull ? 'up' : 'down'}`}>
                  {pct(((s.projection - s.lastFull) / s.lastFull) * 100)}
                </span>
              ) : null}
            </div>
            <div className="v3-kpi-note">
              {s.projectionYears
                ? `Your usual season, ${s.projectionYears} past years · straight pace ${rmFull(s.projectionStraight)}`
                : 'At this pace'}{' '}
              · {s.year - 1} closed at {rmFull(s.lastFull)}
            </div>
          </a>
          <a className="v3-kpi" href="#owed">
            <div className="v3-kpi-label">Owed to me</div>
            <div className="v3-kpi-value">{rmFull(s.owedTotal)}</div>
            <div className="v3-kpi-note">
              {s.owed.length} tracked unpaid, last 120 days{s.untracked ? ` · ${s.untracked} not tracked yet` : ''}
            </div>
          </a>
          {both ? (
            <a className="v3-kpi" href="#audience">
              <div className="v3-kpi-label">Social reach, last month</div>
              <div className="v3-kpi-value">{compact(allReach)}</div>
              <div className="v3-kpi-note">
                Instagram {compact(reach30)} + Facebook {compact(fbViewers ?? 0)} · platform total, someone on both counts twice
              </div>
            </a>
          ) : (
            <a className="v3-kpi" href="#audience">
              <div className="v3-kpi-label">{reach30 ? 'Instagram reach, 30 days' : 'Instagram reach per post'}</div>
              <div className="v3-kpi-value">{reach30 ? compact(reach30) : stats ? compact(stats.reachPerPost) : '—'}</div>
              <div className="v3-kpi-note">
                {newPct !== null ? `${Math.round(newPct)}% new people · ` : ''}
                {compact(audience.followers)} followers
              </div>
            </a>
          )}
      </section>

      {/* ---------------- The body ---------------- */}

      <div className="v3-grid">
        <section className="v3-panel v3-span-12" id="on-track" aria-labelledby="t-track">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-track">
              On track this year
            </h2>
            <p className="v3-panel-note">
              Running total, {s.year} against {s.year - 1} on one scale
            </p>
          </div>
          <PaceChart pace={s.pace} year={s.year} />
        </section>

        <section className="v3-panel v3-span-4" id="owed" aria-labelledby="t-owed">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-owed">
              Who owes me
            </h2>
            <a className="v3-panel-link" href="/invoices/details#owed">
              Invoice Details
            </a>
          </div>
          <Receivables
            owed={s.owed}
            owedTotal={s.owedTotal}
            recentPaid={s.recentPaid}
            untracked={s.untracked}
            olderCount={s.unconfirmedOlder}
            filtered={!!filterNote}
          />
        </section>

          <section className="v3-panel v3-span-4" id="risk" aria-labelledby="t-risk">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-risk">
                Client risk
              </h2>
              <a className="v3-panel-link" href="/invoices">
                Invoice Summary
              </a>
            </div>
            <ClientRiskCard r={risk} />
          </section>

          <section className="v3-panel v3-span-4" aria-labelledby="t-clients">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-clients">
                Biggest clients
              </h2>
              <a className="v3-panel-link" href="/clients">
                All clients
              </a>
            </div>
            {s.clients.length ? (
              <div className="v3-rows">
                {s.clients.slice(0, 5).map(c => (
                  <a key={c.client} className="v3-row" href={withParam(filters, 'client', c.client)}>
                    <div className="v3-row-main">
                      <div className="v3-row-title">{c.client}</div>
                      <div className="v3-row-sub">
                        {c.count} job{c.count === 1 ? '' : 's'} · {Math.round(c.share * 100)}% of the range
                      </div>
                    </div>
                    <div className="v3-row-num">{rmFull(c.total)}</div>
                    <div className="v3-row-bar">
                      <i style={{ ['--w' as string]: (c.total / (s.clients[0]?.total || 1)).toFixed(3) }} />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="v3-empty">No clients in this range.</p>
            )}
          </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-strip">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-strip">
                {s.year}, month by month
              </h2>
              <p className="v3-panel-note">Click a month to filter the page to it</p>
            </div>
            <Strip frames={s.frames} bestKey={s.bestMonth?.key ?? null} />
          </section>

        <section className="v3-panel v3-span-12" id="audience" aria-labelledby="t-aud">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-aud">
              Is my audience growing
            </h2>
            <a className="v3-panel-link" href="/instagram">
              Instagram
            </a>
            {hasFb ? (
              <a className="v3-panel-link" href="/facebook">
                Facebook
              </a>
            ) : null}
            {hasTt ? (
              <a className="v3-panel-link" href="/tiktok">
                TikTok
              </a>
            ) : null}
          </div>
          {both ? (
            <>
              <p className="v3-kpi-label" style={{ marginBottom: 'var(--space-3)' }}>Instagram + Facebook{ttFresh ? ' + TikTok' : ''}</p>
              <div className="v3-kpis" style={{ marginBottom: 'var(--space-5)' }}>
                <div>
                  <div className="v3-kpi-label">Followers, {ttFresh ? 'all three' : 'both'}</div>
                  <div className="v3-kpi-value num">{num(allFollowers)}</div>
                  <div className="v3-kpi-note">
                    {allNet !== null ? `${allNet >= 0 ? '+' : ''}${num(allNet)} in the last 30 days · ` : ''}
                    {Math.round((fb!.followers / Math.max(1, allFollowers)) * 100)}% on Facebook
                    {ttFresh ? ` · ${Math.round((ttFollowers / Math.max(1, allFollowers)) * 100)}% on TikTok` : ''}
                  </div>
                </div>
                <div>
                  <div className="v3-kpi-label">Reached, both</div>
                  <div className="v3-kpi-value num">{compact(allReach)}</div>
                  <div className="v3-kpi-note">Instagram 30 days + Facebook 28 days · someone on both counts twice</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Where people saw you</div>
                  <div className="v3-kpi-value num">{allReach ? `${Math.round(((fbViewers ?? 0) / allReach) * 100)}%` : '—'}</div>
                  <div className="v3-kpi-note">of that reach was on Facebook</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Posting, {ttFresh ? 'all three' : 'both'}</div>
                  <div className="v3-kpi-value num">{((stats?.postsPerWeek ?? 0) + (fbStats?.postsPerWeek ?? 0) + (ttFresh ? (ttStats?.postsPerWeek ?? 0) : 0)).toFixed(1)}/wk</div>
                  <div className="v3-kpi-note">
                    Instagram {(stats?.postsPerWeek ?? 0).toFixed(1)} · Facebook {(fbStats?.postsPerWeek ?? 0).toFixed(1)}
                    {ttFresh ? ` · TikTok ${(ttStats?.postsPerWeek ?? 0).toFixed(1)}` : ''} · a cross-post counts on each
                  </div>
                </div>
              </div>
            </>
          ) : null}
          {stats ? (
            <>
              {hasFb ? <p className="v3-kpi-label" style={{ marginBottom: 'var(--space-3)' }}>Instagram</p> : null}
              <div className="v3-kpis" style={{ marginBottom: 'var(--space-5)' }}>
                <div>
                  <div className="v3-kpi-label">Followers</div>
                  <div className="v3-kpi-value num">{num(audience.followers)}</div>
                  <div className="v3-kpi-note">
                    {netFollows !== null
                      ? `${netFollows >= 0 ? '+' : ''}${num(netFollows)} in the last 30 days`
                      : audience.historyDays > 0
                        ? `Tracked for ${audience.historyDays} days`
                        : 'Growth appears as daily snapshots build up'}
                  </div>
                </div>
                <div>
                  <div className="v3-kpi-label">{reach30 ? 'Accounts reached' : 'Reach per post'}</div>
                  <div className="v3-kpi-value num">{compact(reach30 || stats.reachPerPost)}</div>
                  <div className="v3-kpi-note">
                    {reach30
                      ? `30 days · ${newPct !== null ? `${Math.round(newPct)}% did not follow you` : `typical post ${compact(stats.baseline.median)}`}`
                      : `${Math.round(stats.reachVsFollowers)}% of followers, ${postWindow}`}
                  </div>
                </div>
                <div>
                  <div className="v3-kpi-label">Engagement</div>
                  <div className="v3-kpi-value num">{(engagedPct ?? stats.engagementRate).toFixed(1)}%</div>
                  <div className="v3-kpi-note">
                    {engagedPct !== null ? 'of accounts reached who interacted · 30 days' : `interactions per post reach, ${postWindow}`}
                  </div>
                </div>
                <div>
                  <div className="v3-kpi-label">Posting</div>
                  <div className="v3-kpi-value num">{stats.postsPerWeek.toFixed(1)}/wk</div>
                  <div className="v3-kpi-note">last post {stats.daysSinceLastPost === 0 ? 'today' : `${stats.daysSinceLastPost} day${stats.daysSinceLastPost === 1 ? '' : 's'} ago`}</div>
                </div>
              </div>
              {reachLine.length >= 3 ? (
                <div className="v3-dash-reach">
                  <span className="v3-kpi-label">Daily reach, last 30 days</span>
                  <Spark values={reachLine} />
                </div>
              ) : null}
              <a className="v3-recv-cta" href="/instagram">
                Growth chart, top posts and audience on Instagram<span aria-hidden="true"> →</span>
              </a>
            </>
          ) : (
            <p className="v3-empty">No Instagram snapshot yet. Take one from the Instagram page.</p>
          )}
          {hasFb && fbFlow && fbStats ? (
            <>
              <p className="v3-kpi-label" style={{ margin: 'var(--space-6) 0 var(--space-3)' }}>Facebook</p>
              <div className="v3-kpis" style={{ marginBottom: 'var(--space-5)' }}>
                <div>
                  <div className="v3-kpi-label">Followers</div>
                  <div className="v3-kpi-value num">{num(fb!.followers)}</div>
                  <div className="v3-kpi-note">{`${fbFlow.net >= 0 ? '+' : ''}${num(fbFlow.net)} in the last 30 days`}</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Viewers</div>
                  <div className="v3-kpi-value num">{fbViewers !== null ? compact(fbViewers) : '—'}</div>
                  <div className="v3-kpi-note">{fb!.window ? `28 days to ${shortDate(fb!.window.until)}` : '28 days'} · typical post {compact(fbStats.typical)}</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Engagement</div>
                  <div className="v3-kpi-value num">{fbEngPer100 !== null ? fbEngPer100.toFixed(1) : '—'}</div>
                  <div className="v3-kpi-note">engagements per 100 viewers · 28 days</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Posting</div>
                  <div className="v3-kpi-value num">{fbStats.postsPerWeek.toFixed(1)}/wk</div>
                  <div className="v3-kpi-note">
                    {fbStats.daysSinceLast === null ? 'no posts stored' : `last post ${fbStats.daysSinceLast === 0 ? 'today' : `${fbStats.daysSinceLast} day${fbStats.daysSinceLast === 1 ? '' : 's'} ago`}`}
                  </div>
                </div>
              </div>
              <a className="v3-recv-cta" href="/facebook">
                Viewers, top posts and growth on Facebook<span aria-hidden="true"> →</span>
              </a>
            </>
          ) : null}
          {hasTt && ttStats && tt90 ? (
            <>
              <p className="v3-kpi-label" style={{ margin: 'var(--space-6) 0 var(--space-3)' }}>TikTok</p>
              <div className="v3-kpis" style={{ marginBottom: 'var(--space-5)' }}>
                <div>
                  <div className="v3-kpi-label">Followers</div>
                  <div className="v3-kpi-value num">{num(tt!.followers)}</div>
                  <div className="v3-kpi-note">
                    {ttNet ? `${ttNet.net >= 0 ? '+' : ''}${num(ttNet.net)} in the last 30 days` : `tracked since ${shortDate(tt!.daily[0].day)}`}
                    {ttFresh ? '' : ' · reading over a week old'}
                  </div>
                </div>
                <div>
                  <div className="v3-kpi-label">Views</div>
                  <div className="v3-kpi-value num">{compact(ttStats.totals.views)}</div>
                  <div className="v3-kpi-note">so far, videos posted in the last 30 days · TikTok gives no reach</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Typical video</div>
                  <div className="v3-kpi-value num">{compact(tt90.typical)}</div>
                  <div className="v3-kpi-note">median views, last 90 days · {tt90.read} videos</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Posting</div>
                  <div className="v3-kpi-value num">{ttStats.postsPerWeek.toFixed(1)}/wk</div>
                  <div className="v3-kpi-note">
                    {ttStats.daysSinceLast === null ? 'no videos stored' : `last video ${ttStats.daysSinceLast === 0 ? 'today' : `${ttStats.daysSinceLast} day${ttStats.daysSinceLast === 1 ? '' : 's'} ago`}`}
                  </div>
                </div>
              </div>
              <a className="v3-recv-cta" href="/tiktok">
                Followers, top videos and what works on TikTok<span aria-hidden="true"> →</span>
              </a>
            </>
          ) : null}
        </section>
        {stats && !demo ? (
          <section className="v3-panel v3-span-12" id="reach-work" aria-labelledby="t-rvw">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-rvw">
                Reach and invoicing
              </h2>
              <a className="v3-panel-link" href="/instagram">
                Instagram
              </a>
            </div>
            <ReachAndWork v={rvw} client={filters.client} />
          </section>
        ) : null}
      </div>
    </div>
  )
}
