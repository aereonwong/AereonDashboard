import '../v3.css'
import '../kit2.css'
import { v3Fonts } from '../fonts'
import type { World } from '@/lib/v3/catalog'
import type { Audience } from '@/lib/v3/audience'
import type { WorkKind } from '@/lib/invoices'
import type { Share } from '@/lib/instagram'
import PostGrid from '../PostGrid'
import AudienceBreakdown from '../AudienceBreakdown'
import Circle from '../Circle'
import Icon from '@/app/_components/Icon'
import { Reveal, CountUp } from '../KitMotion'
import { compact, longDate, shortDate } from '../fmt'
import { KIT_BRANDS, logoSize } from '@/lib/v3/brands'

// 👉 The public creator media kit, version 2 (2 Oct 2026). v1 (MediaKit.tsx) stays
// selectable in Settings for comparison.
//
// What changed: v1 could only say how many people follow. v2 answers what a
// brand actually asks — who are they, where are they, does the work reach past
// the fan base, and do people watch it — from Instagram's own account insights.
//
// The composition is shared by all three worlds; only material changes, as in
// DESIGN.md. One authored moment: the reach skyline, thirty days of daily reach
// rising as a city line on scroll — the same skyline Aereon flies over.
//
// Hard rules kept from v1: no client names, no amounts, no private business data,
// and no figure that Instagram did not report. A section without data is left out.

const SERVICES: Record<WorkKind, { title: string; line: string } | null> = {
  'Drone / aerial': { title: 'Aerial & drone', line: 'Licensed aerial film and photography — skylines, resorts, launches and drone shows.' },
  'Social campaign': { title: 'Social campaigns', line: 'Reels and TikToks built to travel, posted to an audience that engages.' },
  'Event coverage': { title: 'Event coverage', line: 'Launches, ceremonies and awards nights, covered from arrival to the last award.' },
  'Production / licensing': { title: 'Production & licensing', line: 'Footage produced to brief, and archive shots licensed for campaigns.' },
  Other: null,
}

const EMAIL = 'aereon.wong@gmail.com'
const IG = 'https://www.instagram.com/aereonwong/'

/** "7 in 10" reads faster than "68.4%" in a sentence. */
const inTen = (pct: number) => `${Math.max(1, Math.round(pct / 10))} in 10`

export default function MediaKit2({
  world,
  audience,
  kinds,
  since,
}: {
  world: World
  audience: Audience
  kinds: WorkKind[]
  since: string
}) {
  const { view, stats, daily } = audience
  const services = kinds.map(k => SERVICES[k]).filter(Boolean) as { title: string; line: string }[]

  const reach = view?.totals.reach ?? stats?.totals.reach ?? 0
  const views = view?.totals.views ?? stats?.totals.views ?? 0
  const engaged = view?.totals.accounts_engaged
  const shares = view?.totals.shares
  const saves = view?.totals.saves
  const newPct = view?.newPeoplePct ?? null

  // The skyline: the last 30 days that carry a reach figure.
  const days = daily.filter(d => d.reach !== undefined).slice(-30)
  const peak = days.reduce((m, d) => ((d.reach ?? 0) > (m?.reach ?? 0) ? d : m), days[0])
  const top = Math.max(...days.map(d => d.reach ?? 0), 1)

  const ages = view?.ages ?? []

  const watch = stats?.watch
  const updated = view?.capturedAt ?? audience.snap?.captured_at

  return (
    <div className={`v3 v3-kit v3-k2 ${v3Fonts}`} data-world={world}>
      {/* ------------------------------------------------ the first viewport */}
      <header className="v3-k2-hero">
        <div className="v3-k2-photo" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/klcc-merdeka.jpg" alt="" fetchPriority="high" />
        </div>
        <nav className="v3-k2-top" aria-label="Contact">
          <span className="v3-k2-mark">Aereon Wong</span>
          <span className="v3-k2-links">
            <a href={IG} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href={`mailto:${EMAIL}`}>Email</a>
            <a href="/dashboard" className="v3-k2-login">
              Studio login
            </a>
          </span>
        </nav>
        {world === 'hud' ? (
          <div className="v3-k2-hud" aria-hidden="true">
            <span>KLCC · MERDEKA NIGHT · 3.153°N 101.712°E</span>
            <span className="v3-kit-rec">
              <i /> REC
            </span>
          </div>
        ) : null}

        <div className="v3-k2-hero-body">
          <h1 className="v3-k2-headline">
            <span className="v3-k2-line">
              <span>Tech &amp; travel,</span>
            </span>
            <span className="v3-k2-line">
              <span>shot from the sky.</span>
            </span>
          </h1>
          <p className="v3-k2-blurb">
            Aereon Wong — creative travel content creator and CAAM-licensed drone pilot in Kuala Lumpur. Aerial films,
            launch campaigns, hotels and tourism, from KLCC rooftops to island resorts.
          </p>
          <div className="v3-kit-ctas">
            <a className="v3-btn v3-btn-primary" href={`mailto:${EMAIL}?subject=Collaboration`}>
              Book a collaboration
            </a>
            <a className="v3-btn v3-k2-ghost" href={IG} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" /> @aereonwong
            </a>
          </div>
        </div>

        {/* Telemetry along the foot of the frame: three readings, one line. */}
        <dl className="v3-k2-telemetry">
          {audience.followers ? (
            <div>
              <dt>Followers</dt>
              <dd>{compact(audience.followers)}</dd>
            </div>
          ) : null}
          {reach ? (
            <div>
              <dt>Reached · 30 days</dt>
              <dd>{compact(reach)}</dd>
            </div>
          ) : null}
          {views ? (
            <div>
              <dt>Views · 30 days</dt>
              <dd>{compact(views)}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <main className="v3-k2-main">
        {/* ------------------------------------------------ reach: the skyline */}
        {reach ? (
          <Reveal className="v3-k2-section v3-k2-reach" aria-labelledby="k2-reach">
            <h2 className="v3-k2-h2" id="k2-reach">
              Reach
            </h2>
            <p className="v3-k2-statement">
              In the last 30 days the work reached{' '}
              <b>
                <CountUp value={reach} format="compact" />
              </b>{' '}
              accounts
              {newPct !== null ? (
                <>
                  {' '}— and{' '}
                  <b className="v3-k2-mark-word">
                    <CountUp value={newPct} format="pct" />
                  </b>{' '}
                  of them did not follow yet. A post here travels past the fan base, to people meeting your brand for the
                  first time.
                </>
              ) : (
                '.'
              )}
            </p>

            {days.length >= 7 ? (
              <figure className="v3-k2-skyline" aria-label={`Accounts reached each day, ${shortDate(days[0].day)} to ${shortDate(days.at(-1)!.day)}`}>
                <div className="v3-k2-bars">
                  {days.map((d, i) => {
                    const isPeak = d === peak
                    return (
                      <span
                        key={d.day}
                        className="v3-k2-bar"
                        data-peak={isPeak || undefined}
                        data-edge={i >= days.length - 4 ? 'end' : i < 4 ? 'start' : undefined}
                        style={{ ['--h' as string]: ((d.reach ?? 0) / top).toFixed(3), ['--i' as string]: i }}
                        title={`${shortDate(d.day)} · ${compact(d.reach ?? 0)} reached`}
                      >
                        {isPeak ? (
                          <span className="v3-k2-peak">
                            <span className="v3-k2-peak-v">{compact(d.reach ?? 0)}</span>
                            <span className="v3-k2-peak-d">{shortDate(d.day)}</span>
                            {world === 'contact' ? <Circle drawn /> : null}
                          </span>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
                <figcaption className="v3-k2-axis">
                  <span>{shortDate(days[0].day)}</span>
                  <span>Accounts reached, day by day</span>
                  <span>{shortDate(days.at(-1)!.day)}</span>
                </figcaption>
              </figure>
            ) : null}
          </Reveal>
        ) : null}

        {/* ------------------------------------------------ who is watching */}
        {view && ages.length ? (
          <Reveal className="v3-k2-section v3-k2-who" aria-labelledby="k2-who">
            <h2 className="v3-k2-h2" id="k2-who">
              Who&rsquo;s watching
            </h2>
            <div className="v3-k2-who-grid">
              <p className="v3-k2-statement v3-k2-who-lede">
                <b>
                  <CountUp value={audience.followers} format="compact" />
                </b>{' '}
                followers.
                {view.coreAgePct !== null ? (
                  <>
                    {' '}
                    <b>{inTen(view.coreAgePct)}</b> are 25–44 — working adults with their own money to spend.
                  </>
                ) : null}
                {view.homePct !== null ? (
                  <>
                    {' '}
                    <b>
                      <CountUp value={view.homePct} format="pct" />
                    </b>{' '}
                    live in Malaysia
                    {view.cities[0] ? (
                      <>
                        {' '}— <b>{Math.round(view.cities[0].pct)}%</b> in {view.cities[0].label} alone
                      </>
                    ) : null}
                    .
                  </>
                ) : null}
              </p>

              <AudienceBreakdown view={view} />
            </div>
          </Reveal>
        ) : null}

        {/* ------------------------------------------------ attention */}
        {watch || shares || engaged ? (
          <Reveal className="v3-k2-section v3-k2-attention" aria-labelledby="k2-att">
            <h2 className="v3-k2-h2" id="k2-att">
              Watched, not scrolled past
            </h2>
            <p className="v3-k2-statement">
              {watch ? (
                <>
                  Each Reel play holds attention for{' '}
                  <b>
                    <CountUp value={watch.avgSec} format="sec" />
                  </b>{' '}
                  on average, and the Reels posted this past month have been watched for{' '}
                  <b>
                    <CountUp value={watch.totalHours} format="hours" />
                  </b>{' '}
                  hours in all.{' '}
                </>
              ) : null}
              {shares ? (
                <>
                  People shared the work <b>{compact(shares)}</b> times
                  {saves ? (
                    <>
                      {' '}and saved it <b>{compact(saves)}</b> times
                    </>
                  ) : null}
                  {engaged ? (
                    <>
                      , and <b>{compact(engaged)}</b> accounts interacted
                    </>
                  ) : null}
                  .
                </>
              ) : null}
            </p>
            {view?.formats.length ? <Formats items={view.formats} /> : null}
          </Reveal>
        ) : null}

        {/* ------------------------------------------------ the work */}
        {audience.top.length ? (
          <Reveal className="v3-k2-section" aria-labelledby="k2-work">
            <h2 className="v3-k2-h2" id="k2-work">
              Recent work
            </h2>
            <p className="v3-k2-note">The furthest-travelling posts of the latest 40 — tap one to play it.</p>
            <PostGrid posts={audience.top} limit={8} circleFirst={world === 'contact'} />
          </Reveal>
        ) : null}

        {/* ------------------------------------------------ services */}
        {services.length ? (
          <Reveal className="v3-k2-section" aria-labelledby="k2-make">
            <h2 className="v3-k2-h2" id="k2-make">
              What I make
            </h2>
            <div className="v3-k2-services">
              {services.map((sv, i) => (
                <div key={sv.title} className="v3-k2-service" style={{ ['--i' as string]: i }}>
                  <h3>{sv.title}</h3>
                  <p>{sv.line}</p>
                </div>
              ))}
            </div>
          </Reveal>
        ) : null}

        {/* ------------------------------------------------ brands */}
        <Reveal className="v3-k2-section" aria-labelledby="k2-brands">
          <h2 className="v3-k2-h2" id="k2-brands">
            Brands I&rsquo;ve made work for
          </h2>
          <ul className="v3-kit-logos v3-k2-logos">
            {KIT_BRANDS.map((b, i) => (
              <li key={b.slug} style={{ ['--i' as string]: i }}>
                <span className="v3-k2-logo-mark">
                  <span
                    className="v3-logo"
                    aria-hidden="true"
                    style={{
                      ['--logo' as string]: `url(/img/brands/${b.slug}.svg)`,
                      width: logoSize(b.aspect).w,
                      height: logoSize(b.aspect).h,
                    }}
                  />
                </span>
                <span className="v3-k2-logo-name">{b.name}</span>
                <span className="v3-k2-logo-kind">{b.kind}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </main>

      {/* ------------------------------------------------ the close */}
      <footer className="v3-k2-close">
        <div className="v3-k2-photo v3-k2-photo-close" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/klcc-sunset.jpg" alt="" loading="lazy" />
        </div>
        <div className="v3-k2-close-body">
          <h2 className="v3-k2-headline v3-k2-close-h">Let&rsquo;s make something that travels.</h2>
          <p className="v3-k2-blurb">Based in Kuala Lumpur, working across Malaysia and the region since {since}.</p>
          <div className="v3-kit-ctas">
            <a className="v3-btn v3-btn-primary" href={`mailto:${EMAIL}?subject=Collaboration`}>
              {EMAIL}
            </a>
            <a className="v3-btn v3-k2-ghost" href={IG} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" /> Message on Instagram
            </a>
          </div>
          {updated ? (
            <p className="v3-k2-source">
              Figures are Instagram&rsquo;s own account insights for @aereonwong, updated {longDate(updated)}.
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

function Formats({ items }: { items: Share[] }) {
  const shown = items.filter(f => f.pct >= 1 && f.key !== 'AD')
  const total = shown.reduce((t, f) => t + f.value, 0)
  if (!total) return null
  return (
    <div className="v3-k2-formats">
      <div className="v3-k2-stack" role="img" aria-label={shown.map(f => `${f.label} ${Math.round((f.value / total) * 100)}%`).join(', ')}>
        {shown.map((f, i) => (
          <i key={f.key} style={{ ['--w' as string]: (f.value / total).toFixed(3), ['--i' as string]: i }} />
        ))}
      </div>
      <ul className="v3-k2-stack-k">
        {shown.map(f => (
          <li key={f.key}>
            {f.label} <b>{Math.round((f.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
      <p className="v3-k2-fine">Where the 30-day reach came from, by format (organic)</p>
    </div>
  )
}
