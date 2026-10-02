import type { Rec } from '@/lib/records'
import { buildStudio } from '@/lib/v3/studio'
import { withParam, type Filters } from '@/lib/v3/filters'
import type { World } from '@/lib/v3/version'
import type { Audience } from '@/lib/v3/audience'
import FilterBar from '../FilterBar'
import PaceChart from './PaceChart'
import Strip from './Strip'
import Owed from './Owed'
import Hud from './Hud'
import PostGrid from '../PostGrid'
import GrowthRhythm from '../GrowthRhythm'
import Circle from '../Circle'
import { rmFull, money, pct, compact, longDate, num } from '../fmt'

// 👉 Dashboard v3 — the creator studio. One composition in every world, led by
// the three questions in PRODUCT.md. Only the first viewport differs by world,
// exactly as each world's direction contract describes.

export default function Dashboard({
  rows,
  filters,
  world,
  audience,
}: {
  rows: Rec[]
  filters: Filters
  world: World
  audience: Audience
}) {
  const s = buildStudio(rows, filters)
  const { stats } = audience
  // Battery: owed vs income over the SAME invoices — filtered, ringgit only,
  // last 120 days — so a client filter can't compare one client with everyone.
  const owedRm = s.owed.filter(o => o.currency === 'MYR')
  const recentTotal = owedRm.reduce((t, o) => t + o.amount, 0)
  const recentIncome = s.recentIncome
  const latestNo = [...rows]
    .filter(r => r.category === 'cash_in' && r.meta?.invoice_no)
    .map(r => String(r.meta?.invoice_no))
    .sort()
    .at(-1)
  const up = (s.pacePct ?? 0) >= 0
  const hist = audience.history
  const reach30 = audience.view?.totals.reach ?? 0
  const engaged30 = audience.view?.totals.accounts_engaged
  const engagedPct = reach30 && engaged30 ? (engaged30 / reach30) * 100 : null
  const postWindow = stats?.window.count ? 'last 30 days' : `last ${stats?.posts.length ?? 0} posts`
  const newPct = audience.view?.newPeoplePct ?? null
  const netFollows =
    audience.view?.follows != null && audience.view?.unfollows != null ? audience.view.follows - audience.view.unfollows : null
  const growth = hist.length >= 2 && hist.at(-1)!.date !== hist[0].date ? hist.at(-1)!.followers - hist[0].followers : null
  const trackLine =
    s.pacePct === null
      ? `No ${s.year - 1} invoices to compare against.`
      : `${up ? 'Ahead of' : 'Behind'} ${s.year - 1} by ${rmFull(Math.abs(s.ytd - s.lastYtd))} at this point in the year.`
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

      {/* ---------------- The first viewport: one per world ---------------- */}

      {world === 'contact' ? (
        <section className="v3-hero v3-sheet-hero v3-enter" aria-label="The three questions">
          <figure className="v3-print" style={{ margin: 0 }}>
            <span className="v3-frame-no">
              {latestNo ?? 'SYCP'} ▸ {longDate(s.today).toUpperCase()}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/klcc-merdeka.jpg" alt="KLCC on Merdeka night, photographed by Aereon" />
            <figcaption className="v3-print-caption">
              <p className="v3-print-figure">
                <span className="cur">RM</span>
                {Math.round(s.ytd).toLocaleString('en-MY')}
              </p>
              <p className="v3-print-line">
                <span className="long">invoiced in {s.year} · </span>
                {s.pacePct === null ? `invoiced in ${s.year}` : (
                  <>
                    <b>{pct(s.pacePct)}</b> on {s.year - 1}
                    <span className="long"> at this point</span>
                  </>
                )}
              </p>
            </figcaption>
          </figure>

          <div className="v3-sheet-notes">
            <a className="v3-sheet-note" href="#on-track">
              <p className="q">On track this year?</p>
              <span className="a">
                <Circle drawn />
                {s.pacePct === null ? 'No data' : up ? 'Yes' : 'Behind'}
              </span>
              <p className="n">
                Heading for {rmFull(s.projection)} at this pace · {s.year - 1} closed at {rmFull(s.lastFull)}
              </p>
            </a>
            <a className="v3-sheet-note" href="#audience">
              <p className="q">Audience growing?</p>
              <span className="a">
                <Circle drawn />
                {growth === null ? 'Too early' : `${growth >= 0 ? '+' : ''}${num(growth)}`}
              </span>
              <p className="n">
                {growth === null
                  ? `Tracking ${compact(audience.followers)} followers from ${audience.history[0] ? longDate(audience.history[0].date) : 'today'}`
                  : `followers since ${longDate(audience.history[0].date)} · ${num(audience.followers)} now`}
              </p>
            </a>
            <a className="v3-sheet-note" href="#owed">
              <p className="q">Who owes me?</p>
              <span className="a">
                <Circle drawn />
                {rmFull(s.owedTotal)}
              </span>
              <p className="n">
                {s.owed.length} invoice{s.owed.length === 1 ? '' : 's'} tracked as unpaid
                {s.untracked ? ` · ${s.untracked} not tracked yet` : ''}
              </p>
            </a>
          </div>

          <div className="v3-sheet-strip">
            <Strip frames={s.frames} bestKey={s.bestMonth?.key ?? null} world={world} />
          </div>
        </section>
      ) : null}

      {world === 'hud' ? (
        <Hud
          year={s.year}
          pace={s.pace}
          frames={s.frames}
          projection={s.projection}
          lastFull={s.lastFull}
          owedTotal={recentTotal}
          owedCount={owedRm.length}
          recentTotal={recentIncome}
          recentPaid={s.recentPaid}
          untracked={s.untracked}
          reachPerPost={stats?.reachPerPost ?? 0}
          reachWindow={postWindow}
          followers={audience.followers}
        />
      ) : null}

      {world === 'canon' ? (
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
            <div className="v3-kpi-note">At this pace · {s.year - 1} closed at {rmFull(s.lastFull)}</div>
          </a>
          <a className="v3-kpi" href="#owed">
            <div className="v3-kpi-label">Owed to me</div>
            <div className="v3-kpi-value">{rmFull(s.owedTotal)}</div>
            <div className="v3-kpi-note">
              {s.owed.length} tracked unpaid, last 120 days{s.untracked ? ` · ${s.untracked} not tracked yet` : ''}
            </div>
          </a>
          <a className="v3-kpi" href="#audience">
            <div className="v3-kpi-label">{reach30 ? 'Instagram reach, 30 days' : 'Instagram reach per post'}</div>
            <div className="v3-kpi-value">{reach30 ? compact(reach30) : stats ? compact(stats.reachPerPost) : '—'}</div>
            <div className="v3-kpi-note">
              {newPct !== null ? `${Math.round(newPct)}% new people · ` : ''}
              {compact(audience.followers)} followers
            </div>
          </a>
        </section>
      ) : null}

      {/* ---------------- The body: shared by every world ---------------- */}

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

        <section className="v3-panel v3-span-7" id="owed" aria-labelledby="t-owed">
          <span className="v3-edge">{s.owed.map(o => o.no).join(' ▸ ')}</span>
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-owed">
              Who owes me
            </h2>
            <p className="v3-panel-note">Tracked as unpaid · last 120 days · issued invoices aren&apos;t counted until tracked</p>
          </div>
          <Owed lines={s.owed} olderCount={s.unconfirmedOlder} untracked={s.untracked} paidCount={s.paidCount} today={s.today} />
        </section>

        <div className="v3-span-5 v3-stack">
          <section className="v3-panel" aria-labelledby="t-mix">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-mix">
                Kind of work
              </h2>
              <p className="v3-panel-note">{rmFull(s.rangeTotal)}</p>
            </div>
            {s.mix.length ? (
              <div className="v3-rows">
                {s.mix.map(x => (
                  <a
                    key={x.kind}
                    className="v3-row"
                    href={withParam(filters, 'kind', filters.kind === x.kind ? undefined : x.kind)}
                    aria-current={filters.kind === x.kind ? 'true' : undefined}
                  >
                    <div className="v3-row-main">
                      <div className="v3-row-title">{x.kind}</div>
                      <div className="v3-row-sub">
                        {x.count} job{x.count === 1 ? '' : 's'} · {Math.round(x.share * 100)}%
                      </div>
                    </div>
                    <div className="v3-row-num">{rmFull(x.total)}</div>
                    <div className="v3-row-bar">
                      <i style={{ ['--w' as string]: x.share.toFixed(3) }} />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="v3-empty">No ringgit invoices in this range.</p>
            )}
            {s.foreign.count ? (
              <p className="v3-panel-note" style={{ marginTop: 'var(--space-4)' }}>
                Plus {s.foreign.byCurrency.map(c => money(c.total, c.currency)).join(' and ')} in foreign currency, kept
                out of these ringgit totals.
              </p>
            ) : null}
          </section>

          <section className="v3-panel" aria-labelledby="t-clients">
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
            {s.keepers.length ? (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <h3 className="v3-panel-title" style={{ fontSize: 'var(--t-md)', marginBottom: 'var(--space-2)' }}>
                  {world === 'contact' ? 'The keepers' : 'Biggest jobs'}
                </h3>
                <div className="v3-rows">
                  {s.keepers.map(k => (
                    <div key={k.id} className="v3-row">
                      <div className="v3-row-main">
                        <div className="v3-row-title">{k.client}</div>
                        <div className="v3-row-sub">
                          <span className="code">{k.no}</span> · {k.kind}
                        </div>
                      </div>
                      <div className="v3-row-num" style={{ position: 'relative', padding: '0 6px' }}>
                        {world === 'contact' ? <Circle drawn /> : null}
                        {rmFull(k.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {world === 'canon' ? (
          <section className="v3-panel v3-span-12" aria-labelledby="t-strip">
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-strip">
                {s.year}, month by month
              </h2>
              <p className="v3-panel-note">Click a month to filter the page to it</p>
            </div>
            <Strip frames={s.frames} bestKey={s.bestMonth?.key ?? null} world={world} />
          </section>
        ) : null}

        <section className="v3-panel v3-span-12" id="audience" aria-labelledby="t-aud">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-aud">
              Is my audience growing
            </h2>
            <a className="v3-panel-link" href="/instagram">
              Instagram
            </a>
          </div>
          {stats ? (
            <>
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
              {audience.daily.length >= 3 ? (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <GrowthRhythm days={audience.daily} posts={audience.snap?.posts ?? []} median={stats.baseline.median} />
                </div>
              ) : null}
              <PostGrid posts={audience.top} limit={6} circleFirst={world === 'contact'} lift={stats.lift} />
            </>
          ) : (
            <p className="v3-empty">No Instagram snapshot yet. Take one from the Instagram page.</p>
          )}
        </section>
      </div>
    </div>
  )
}
