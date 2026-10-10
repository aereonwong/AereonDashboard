import '../v3.css'
import '../kit2.css'
import { v3Fonts } from '../fonts'
import { publicCountries, sharePct, type Audience } from '@/lib/v3/audience'
import type { WorkKind } from '@/lib/invoices'
import type { Share } from '@/lib/instagram'
import Icon from '@/app/_components/Icon'
import { compact, longDate } from '../fmt'
import { KIT_BRANDS, logoSize } from '@/lib/v3/brands'
import ShowcaseGrid, { showcase } from '@/app/_components/ShowcaseGrid'
import SocialLinks from '@/app/_components/SocialLinks'
import { EMAIL } from '@/lib/agent-site'

// 👉 The public creator media kit, version 2. Reworked 3 Oct 2026 to the Front
// door's calm: one KLCC night photo behind everything, Aereon's portrait first,
// glass tiles, and every section one tidy row — no scroll-in gaps.
// Branding: Tech & Travel Content Creator.
//
// Hard rules: no client names, no amounts, no private business data, and no
// figure that Instagram did not report. A section without data is left out.

const SERVICES: Record<WorkKind, { title: string; line: string } | null> = {
  'Drone / aerial': { title: 'Aerial & drone', line: 'Licensed aerial film and photography — skylines, resorts, launches and drone shows.' },
  'Social campaign': { title: 'Social campaigns', line: 'Reels and TikToks built to travel, posted to an audience that engages.' },
  'Event coverage': { title: 'Event coverage', line: 'Launches, ceremonies and awards nights, covered from arrival to the last award.' },
  'Production / licensing': { title: 'Production & licensing', line: 'Footage produced to brief, and archive shots licensed for campaigns.' },
  Other: null,
}

const IG = 'https://www.instagram.com/aereonwong/'

// The logo wall always fills whole rows: 15 → 5·5·5, 12 → 6·6, 10 → 5·5, 9 → 3·3·3.
const wallColumns = (n: number) => [5, 6, 4, 3].find(c => n % c === 0 && n / c <= 4) ?? 5

const Mail = () => (
  <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
)

function ShareList({ items, max = 4, precise }: { items: Share[]; max?: number; precise?: boolean }) {
  const top = items.slice(0, max)
  const peak = Math.max(1, ...top.map(s => s.pct))
  return (
    <ul className="k3-share">
      {top.map(s => (
        <li key={s.key}>
          <span className="k3-share-label">{s.label}</span>
          <span className="k3-share-bar" aria-hidden="true">
            <i style={{ ['--w' as string]: (s.pct / peak).toFixed(3) }} />
          </span>
          <b className="num">{precise ? sharePct(s.pct) : Math.round(s.pct)}%</b>
        </li>
      ))}
    </ul>
  )
}

export default function MediaKit2({ audience, kinds, since }: { audience: Audience; kinds: WorkKind[]; since: string }) {
  const { view } = audience
  const services = kinds.map(k => SERVICES[k]).filter(Boolean) as { title: string; line: string }[]
  // Instagram's own 30-day account figures — only while fresh (the cron refreshes
  // daily); an old row would show a stale "30 days", so the tiles are left out.
  const fresh = !!view && Date.now() - Date.parse(view.capturedAt) <= 7 * 86_400_000
  const reach = fresh ? (view?.totals.reach ?? 0) : 0
  const views = fresh ? (view?.totals.views ?? 0) : 0
  const newPct = fresh ? (view?.newPeoplePct ?? null) : null
  const posts = audience.best.slice(0, 10) // two rows of five
  const updated = view?.capturedAt ?? audience.snap?.captured_at
  const women = view?.genders.find(g => /^f/i.test(g.key))
  const men = view?.genders.find(g => /^m/i.test(g.key))

  return (
    <div className={`v3 v3-kit k3 ${v3Fonts}`} data-world="canon">
      <div className="k3-photo" aria-hidden="true" />
      <div className="k3-scrim" aria-hidden="true" />

      <div className="k3-inner">
        <header className="k3-top">
          <span className="k3-mark">
            <span className="k3-dot" aria-hidden="true" /> Aereon Wong
          </span>
          <nav className="k3-links" aria-label="Contact">
            <a href={IG} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href={`mailto:${EMAIL}`}>Email</a>
            <a className="k3-enter" href="/dashboard">
              Studio login →
            </a>
          </nav>
        </header>

        {/* ------------------------------------------------ hero */}
        <section className="k3-hero" aria-label="Introduction">
          <div className="k3-person">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="k3-face" src="/img/aereon.jpg" alt="Aereon Wong" />
            <div>
              <p className="k3-name">Hi, I&rsquo;m Aereon Wong.</p>
              <p className="k3-role">Tech &amp; Travel Content Creator · drone pilot · Kuala Lumpur</p>
            </div>
          </div>
          <h1 className="k3-headline">
            Tech and Travel
            <br />
            <span className="k3-tint">Content Creator</span>
          </h1>
          <p className="k3-blurb">
            Creative travel and tech content, and aerial work — launch campaigns, hotels and tourism, from
            KLCC rooftops to island resorts. Creating since {since}.
          </p>
          <div className="k3-cta">
            <a className="k3-btn solid" href={`mailto:${EMAIL}?subject=Collaboration`}>
              <Mail /> Work with me
            </a>
            <a className="k3-btn ghost" href={IG} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" /> @aereonwong
            </a>
          </div>

          <dl className="k3-stats">
            {audience.followers ? (
              <div className="k3-stat">
                <dd className="num">{compact(audience.followers)}</dd>
                <dt>Followers</dt>
              </div>
            ) : null}
            {reach ? (
              <div className="k3-stat">
                <dd className="num">{compact(reach)}</dd>
                <dt>Reached · 30 days</dt>
              </div>
            ) : null}
            {views ? (
              <div className="k3-stat">
                <dd className="num">{compact(views)}</dd>
                <dt>Views · 30 days</dt>
              </div>
            ) : null}
            {newPct !== null ? (
              <div className="k3-stat">
                <dd className="num">{Math.round(newPct)}%</dd>
                <dt>Of reach · not following yet</dt>
              </div>
            ) : null}
          </dl>
        </section>

        {/* ------------------------------------------------ channels */}
        <section className="k3-section" aria-labelledby="k3-social">
          <h2 className="k3-h2" id="k3-social">
            Find me on
          </h2>
          <SocialLinks igFollowers={audience.followers} />
        </section>

        {/* ------------------------------------------------ audience */}
        {view && (view.countries.length || view.ages.length || women || men) ? (
          <section className="k3-section" aria-labelledby="k3-aud">
            <h2 className="k3-h2" id="k3-aud">
              Who&rsquo;s watching
            </h2>
            <div className="k3-cards k3-cards-3">
              {view.countries.length ? (
                <div className="k3-card">
                  <h3>Where they are</h3>
                  <ShareList items={publicCountries(view.countries)} precise />
                </div>
              ) : null}
              {view.ages.length ? (
                <div className="k3-card">
                  <h3>Age</h3>
                  <ShareList items={[...view.ages].sort((a, b) => b.pct - a.pct)} />
                </div>
              ) : null}
              {women || men ? (
                <div className="k3-card">
                  <h3>Gender</h3>
                  <div className="k3-gender">
                    {women ? (
                      <p>
                        <b className="num">{Math.round(women.pct)}%</b> women
                      </p>
                    ) : null}
                    {men ? (
                      <p>
                        <b className="num">{Math.round(men.pct)}%</b> men
                      </p>
                    ) : null}
                  </div>
                  {view.cities[0] ? <p className="k3-note">Top city: {view.cities[0].label}</p> : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------ work */}
        {/* Two years of work, one tile per kind (lib/showcase.ts); the recent
            feed is only the fallback, since lately it is mostly KLCC. */}
        {showcase.items.length ? (
          <section className="k3-section" aria-labelledby="k3-work">
            <h2 className="k3-h2" id="k3-work">
              Work across the board
            </h2>
            <ShowcaseGrid />
          </section>
        ) : posts.length ? (
          <section className="k3-section" aria-labelledby="k3-work">
            <h2 className="k3-h2" id="k3-work">
              Recent best work
            </h2>
            <ul className="k3-posts">
              {posts.map(p => (
                <li key={p.id}>
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open on Instagram: ${p.caption.slice(0, 80)}`}>
                    <span className="k3-post-fallback">{p.caption.slice(0, 90)}</span>
                    {p.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb} alt="" loading="lazy" />
                    ) : null}
                    {(p.views ?? p.reach) !== undefined ? (
                      <span className="k3-post-reach">
                        <b className="num">{compact((p.views ?? p.reach)!)}</b> {p.views !== undefined ? 'views' : 'reached'}
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ------------------------------------------------ services */}
        {services.length ? (
          <section className="k3-section" aria-labelledby="k3-make">
            <h2 className="k3-h2" id="k3-make">
              What I make
            </h2>
            <div className="k3-cards" style={{ ['--cols' as string]: Math.min(4, services.length) }}>
              {services.map(s => (
                <div className="k3-card" key={s.title}>
                  <h3>{s.title}</h3>
                  <p className="k3-note">{s.line}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------ brands */}
        <section className="k3-section" aria-labelledby="k3-brands">
          <h2 className="k3-h2" id="k3-brands">
            Brands I&rsquo;ve made work for
          </h2>
          <ul className="k3-logos" style={{ ['--cols' as string]: wallColumns(KIT_BRANDS.length) }}>
            {KIT_BRANDS.map(b => (
              <li key={b.slug} title={`${b.name} · ${b.kind}`}>
                <span
                  className="v3-logo"
                  role="img"
                  aria-label={b.name}
                  style={{
                    ['--logo' as string]: `url(/img/brands/${b.slug}.svg)`,
                    width: logoSize(b.aspect).w,
                    height: logoSize(b.aspect).h,
                  }}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ close */}
        <section className="k3-close" aria-label="Get in touch">
          <h2 className="k3-h2">Let&rsquo;s make something that travels.</h2>
          <div className="k3-cta">
            <a className="k3-btn solid" href={`mailto:${EMAIL}?subject=Collaboration`}>
              <Mail /> {EMAIL}
            </a>
            <a className="k3-btn ghost" href={IG} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" /> Instagram
            </a>
          </div>
        </section>

        <footer className="k3-foot">
          <span>SY Creative Production Sdn. Bhd.</span>
          <span>Aerial · Travel · Tech · Hotels · Events</span>
          <span>{updated ? `Instagram figures as of ${longDate(updated.slice(0, 10))}` : 'Photos: Aereon Wong · Kuala Lumpur'}</span>
        </footer>
      </div>
    </div>
  )
}
