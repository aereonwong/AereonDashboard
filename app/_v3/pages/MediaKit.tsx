import '../v3.css'
import { v3Fonts } from '../fonts'
import type { Audience } from '@/lib/v3/audience'
import type { WorkKind } from '@/lib/invoices'
import ShowcaseGrid, { showcase } from '@/app/_components/ShowcaseGrid'
import SocialLinks from '@/app/_components/SocialLinks'
import { socials, combined } from '@/lib/socials'
import type { SocialTotals } from '@/lib/social-totals'
import { EMAIL } from '@/lib/agent-site'
import PostGrid from '../PostGrid'
import Icon from '@/app/_components/Icon'
import { compact, num } from '../fmt'
import { KIT_BRANDS, logoSize } from '@/lib/v3/brands'

// 👉 The public creator media kit — the one page brands see. Persuade mode: its
// job is to make a brand want to book Aereon, and make booking one tap away.
//
// Hard rule inherited from the landing page it replaces: no client names, no
// amounts, no private business data. Reach comes from the Instagram snapshot;
// brand names come from invoice project text, shown as words, never logos.

const SERVICES: Record<WorkKind, { title: string; line: string } | null> = {
  'Drone / aerial': { title: 'Aerial & drone', line: 'Licensed aerial film and photography — skylines, resorts, launches and drone shows.' },
  'Social campaign': { title: 'Social campaigns', line: 'Reels and TikToks built to travel, posted to an audience that engages.' },
  'Event coverage': { title: 'Event coverage', line: 'Launches, ceremonies and awards nights, covered from arrival to the last award.' },
  'Production / licensing': { title: 'Production & licensing', line: 'Footage produced to brief, and archive shots licensed for campaigns.' },
  Other: null,
}

const IG = 'https://www.instagram.com/aereonwong/'

export default function MediaKit({
  audience,
  brands,
  kinds,
  since,
  totals,
}: {
  audience: Audience
  brands: string[]
  kinds: WorkKind[]
  since: string
  totals: SocialTotals
}) {
  const s = audience.stats
  const top = audience.best[0]
  const services = kinds.map(k => SERVICES[k]).filter(Boolean) as { title: string; line: string }[]

  // Reach as one composed sentence, built only from figures that exist.
  // Followers and reach are overall figures across every platform (lib/social-totals.ts):
  // each platform's latest month of unique people, added. Summing post reach would count
  // people twice, so with no account figures the line is left out.
  const followers = combined(socials(totals.followers.instagram ?? audience.followers, totals.followers.facebook, totals.followers.tiktok))
  const reachLine = totals.reach ? compact(totals.reach) : null
  const topLine = top?.reach ? compact(top.reach) : null
  // Engagement on every platform alike: interactions per 100 views of the last 30 days' posts (lib/social-totals.ts).
  const engage = totals.rate !== null ? totals.rate.toFixed(1) : null

  return (
    <div className={`v3 v3-kit ${v3Fonts}`} data-world="canon">
      <div className="v3-backdrop" aria-hidden="true" />
      <div className="v3-kit-inner">
        <header className="v3-kit-top">
          <span className="v3-kit-mark">Aereon Wong</span>
          <nav className="v3-kit-nav" aria-label="Contact">
            <a href={IG} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href={`mailto:${EMAIL}`}>Email</a>
            <a href="/dashboard" className="v3-kit-login">
              Studio login
            </a>
          </nav>
        </header>

        {/* ---------------- The first viewport: the work is the proof ---------------- */}
        <section className="v3-kit-hero" aria-label="Introduction">
            <div className="v3-kit-split">
              <div>
                <h1 className="v3-kit-headline">
                  Tech and Travel
                  <br />
                  Content Creator
                </h1>
                <p className="v3-kit-blurb">
                  Creative visual travel content creator and professional drone pilot in Kuala Lumpur. Aerial films, launch
                  campaigns, hotels and tourism — from KLCC rooftops to island resorts.
                </p>
                <div className="v3-kit-ctas">
                  <a className="v3-btn v3-btn-primary" href={`mailto:${EMAIL}?subject=Collaboration`}>
                    Book a collaboration
                  </a>
                  <a className="v3-btn" href={IG} target="_blank" rel="noopener noreferrer">
                    <Icon name="instagram" /> @aereonwong
                  </a>
                </div>
              </div>
              <figure className="v3-kit-portrait">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/aereon.jpg" alt="Aereon Wong" />
              </figure>
            </div>
        </section>

        {/* ---------------- Reach ---------------- */}
        <section className="v3-kit-section" aria-labelledby="k-reach">
          <h2 className="v3-kit-h2" id="k-reach">
            Reach
          </h2>
          <p className="v3-kit-statement">
            {followers ? (
              <>
                <b>{compact(followers)}</b> people follow along.{' '}
              </>
            ) : null}
            {reachLine ? (
              <>
                In the last month the work reached <b>{reachLine}</b> people
                {topLine ? (
                  <>
                    {' '}— the best post of the last 3 months alone reached <b>{topLine}</b>
                  </>
                ) : null}
                .
                {engage ? (
                  <>
                    {' '}Every 100 views earn <b>{engage}</b> likes, comments and shares.
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </section>

        {/* ---------------- Channels ---------------- */}
        <section className="v3-kit-section" aria-labelledby="k-social">
          <h2 className="v3-kit-h2" id="k-social">
            Find me on
          </h2>
          <SocialLinks igFollowers={totals.followers.instagram ?? audience.followers} fbFollowers={totals.followers.facebook} ttFollowers={totals.followers.tiktok} />
        </section>

        {/* ---------------- Best work, playable ---------------- */}
        {showcase.items.length ? (
          <section className="v3-kit-section" aria-labelledby="k-work">
            <h2 className="v3-kit-h2" id="k-work">
              Work across the board
            </h2>
            <ShowcaseGrid />
          </section>
        ) : audience.best.length ? (
          <section className="v3-kit-section" aria-labelledby="k-work">
            <h2 className="v3-kit-h2" id="k-work">
              Best work, last 3 months
            </h2>
            <PostGrid posts={audience.best} limit={6} />
          </section>
        ) : null}

        {/* ---------------- What I make ---------------- */}
        {services.length ? (
          <section className="v3-kit-section" aria-labelledby="k-make">
            <h2 className="v3-kit-h2" id="k-make">
              What I make
            </h2>
            <div className="v3-kit-services">
              {services.map(sv => (
                <div key={sv.title} className="v3-kit-service">
                  <h3>{sv.title}</h3>
                  <p>{sv.line}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ---------------- Brands ---------------- */}
        <section className="v3-kit-section" aria-labelledby="k-brands">
          <h2 className="v3-kit-h2" id="k-brands">
            Brands I&rsquo;ve made work for
          </h2>
          <ul className="v3-kit-logos">
            {KIT_BRANDS.map(b => (
              <li key={b.slug}>
                <span
                  className="v3-logo"
                  role="img"
                  aria-label={b.name}
                  title={b.name}
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

        {/* ---------------- The close ---------------- */}
        <section className="v3-kit-close" aria-labelledby="k-close">
          <h2 className="v3-kit-headline" id="k-close">
            Let&rsquo;s make something that travels.
          </h2>
          <p className="v3-kit-blurb">Based in Kuala Lumpur, working across Malaysia and the region since {since}.</p>
          <div className="v3-kit-ctas">
            <a className="v3-btn v3-btn-primary" href={`mailto:${EMAIL}?subject=Collaboration`}>
              {EMAIL}
            </a>
            <a className="v3-btn" href={IG} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" /> Message on Instagram
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
