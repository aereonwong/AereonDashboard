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
import { rmFull, pct, compact, num } from '../fmt'
import { PLATFORM_NAME, type Social } from '@/lib/v3/social'
import { Compare, FollowersChart, MonthsChart, shown } from '../SocialOverview'

// 👉 Dashboard v3 — the creator studio, led by the three questions in PRODUCT.md.
// The daily pulse: deeper money analysis lives on Invoice Summary.

export default function Dashboard({
  rows,
  filters,
  audience,
  metrics = [],
  demo = false,
  social,
}: {
  rows: Rec[]
  filters: Filters
  audience: Audience
  metrics?: MetricRow[] // latest stored reading per post — reach history past the newest 40 posts
  demo?: boolean // demo invoices are invented: never set them against real Instagram reach
  social: Social // every platform, last 30 days (lib/v3/social.ts) — the same maths as /social
}) {
  const s = buildStudio(rows, filters)
  const risk = clientRisk(rows, filters, s.today)
  const rvw = reachVsWork(rows, filters, postReach(audience.snap?.posts ?? [], metrics), s.today)
  const { stats } = audience
  const up = (s.pacePct ?? 0) >= 0
  const reach30 = audience.view?.totals.reach ?? 0
  const newPct = audience.view?.newPeoplePct ?? null
  const trackLine =
    s.pacePct === null
      ? `No ${s.year - 1} invoices to compare against.`
      : `${up ? 'Ahead of' : 'Behind'} ${s.year - 1} by ${rmFull(Math.abs(s.ytd - s.lastYtd))} at this point in the year.`
  // Social reach in the hero = Instagram + Facebook (TikTok reports no reach). Both current,
  // or the hero falls back to Instagram alone rather than reading a missing platform as zero.
  const both = social.hasFb && social.fbFresh && reach30 > 0
  const fbViewers = social.fb.people
  const allReach = reach30 + (fbViewers ?? 0)
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`
  const platforms = shown(social)
  const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''))
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
            <a className="v3-panel-link" href="/social">
              Overview
            </a>
            {platforms.map(p => (
              <a key={p} className="v3-panel-link" href={p === 'ig' ? '/instagram' : p === 'fb' ? '/facebook' : '/tiktok'}>
                {PLATFORM_NAME[p]}
              </a>
            ))}
          </div>
          {social.hasIg || social.hasFb || social.hasTt ? (
            <>
              <div className="v3-kpis" style={{ marginBottom: 'var(--space-5)' }}>
                <div>
                  <div className="v3-kpi-label">Followers, every platform</div>
                  <div className="v3-kpi-value num">{num(social.total.followers)}</div>
                  <div className="v3-kpi-note">
                    {social.total.net30 !== null
                      ? `${signed(social.total.net30)} in 30 days${social.total.netOf.length < platforms.length ? ` (${and(social.total.netOf.map(p => PLATFORM_NAME[p]))})` : ''}`
                      : 'change shows as history builds'}{' '}
                    · someone on two counts twice
                  </div>
                </div>
                <div>
                  <div className="v3-kpi-label">Views, last month</div>
                  <div className="v3-kpi-value num">{social.total.views !== null ? compact(social.total.views) : '—'}</div>
                  <div className="v3-kpi-note">every showing on {and(platforms.map(p => PLATFORM_NAME[p]))}</div>
                </div>
                <div>
                  <div className="v3-kpi-label">People reached</div>
                  <div className="v3-kpi-value num">{social.total.people !== null ? compact(social.total.people) : '—'}</div>
                  <div className="v3-kpi-note">Instagram 30 days + Facebook 28 days · TikTok reports no reach</div>
                </div>
                <div>
                  <div className="v3-kpi-label">Posting</div>
                  <div className="v3-kpi-value num">{social.total.perWeek.toFixed(1)}/wk</div>
                  <div className="v3-kpi-note">{platforms.map(p => `${PLATFORM_NAME[p]} ${social[p].perWeek.toFixed(1)}`).join(' · ')}</div>
                </div>
              </div>
              <div className="v3-dash-social-charts">
                <div>
                  <p className="v3-kpi-label">Views by posting month</p>
                  <MonthsChart s={social} />
                </div>
                <div>
                  <p className="v3-kpi-label">Followers, last 90 days</p>
                  <FollowersChart s={social} />
                </div>
              </div>
              <Compare s={social} />
              <a className="v3-recv-cta" href="/social">
                Best posts, formats and posting rhythm across every platform<span aria-hidden="true"> →</span>
              </a>
            </>
          ) : (
            <p className="v3-empty">No social history yet. Refresh from the Instagram, Facebook and TikTok pages.</p>
          )}
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
