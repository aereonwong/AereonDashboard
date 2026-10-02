import '../v3.css'
import { v3Fonts } from '../fonts'
import type { World } from '@/lib/v3/catalog'
import type { Audience } from '@/lib/v3/audience'
import type { WorkKind } from '@/lib/invoices'
import PostGrid from '../PostGrid'
import Circle from '../Circle'
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

const EMAIL = 'aereon.wong@gmail.com'
const IG = 'https://www.instagram.com/aereonwong/'

export default function MediaKit({
  world,
  audience,
  brands,
  kinds,
  since,
}: {
  world: World
  audience: Audience
  brands: string[]
  kinds: WorkKind[]
  since: string
}) {
  const s = audience.stats
  const top = audience.top[0]
  const services = kinds.map(k => SERVICES[k]).filter(Boolean) as { title: string; line: string }[]

  // Reach as one composed sentence, built only from figures that exist.
  // Only Instagram's own 30-day account figures (unique people). Summing post
  // reach would count people twice, so with no account row the line is left out.
  const v = audience.view?.totals
  const reachLine = v?.reach ? compact(v.reach) : null
  const topLine = top?.reach ? compact(top.reach) : null
  const engage = v?.reach && v.accounts_engaged ? `${((v.accounts_engaged / v.reach) * 100).toFixed(1)}%` : null

  return (
    <div className={`v3 v3-kit ${v3Fonts}`} data-world={world}>
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
          {world === 'contact' ? (
            <div className="v3-kit-sheet">
              <figure className="v3-kit-print">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/klcc-merdeka.jpg" alt="KLCC lit for Merdeka, photographed from the air by Aereon Wong" />
                <figcaption>
                  <span className="v3-kit-name">Aereon Wong</span>
                  <span className="v3-kit-role">Tech &amp; travel, shot from the sky</span>
                </figcaption>
              </figure>
              <div className="v3-kit-frames" aria-hidden="true">
                <span className="v3-kit-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/klcc-sunset.jpg" alt="" />
                </span>
                <span className="v3-kit-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/klcc-balloon.jpg" alt="" />
                  <Circle drawn />
                </span>
                <span className="v3-kit-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/aereon.jpg" alt="" />
                </span>
              </div>
            </div>
          ) : (
            <div className="v3-kit-split">
              <div>
                <h1 className="v3-kit-headline">
                  Tech &amp; travel,
                  <br />
                  shot from the sky.
                </h1>
                <p className="v3-kit-blurb">
                  Creative visual travel content creator and professional drone pilot in Kuala Lumpur. Aerial films, launch
                  campaigns, hotels and tourism — from KLCC rooftops to island resorts.
                </p>
                <span className="v3-kit-credential">CAAM-licensed drone pilot</span>
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
                <img src={world === 'hud' ? '/img/klcc-merdeka.jpg' : '/img/aereon.jpg'} alt={world === 'hud' ? 'KLCC lit for Merdeka, from the air' : 'Aereon Wong'} />
                {world === 'hud' ? (
                  <figcaption className="v3-kit-hud">
                    <span>KLCC · MERDEKA NIGHT</span>
                    <span className="v3-kit-rec">
                      <i aria-hidden="true" /> REC
                    </span>
                  </figcaption>
                ) : null}
              </figure>
            </div>
          )}
          {world === 'contact' ? (
            <div className="v3-kit-intro">
              <div>
                <p className="v3-kit-blurb">
                  Creative visual travel content creator and professional drone pilot in Kuala Lumpur. Aerial films, launch
                  campaigns, hotels and tourism — from KLCC rooftops to island resorts.
                </p>
                <span className="v3-kit-credential">CAAM-licensed drone pilot</span>
              </div>
              <div className="v3-kit-ctas">
                <a className="v3-btn v3-btn-primary" href={`mailto:${EMAIL}?subject=Collaboration`}>
                  Book a collaboration
                </a>
                <a className="v3-btn" href={IG} target="_blank" rel="noopener noreferrer">
                  <Icon name="instagram" /> @aereonwong
                </a>
              </div>
            </div>
          ) : null}
        </section>

        {/* ---------------- Reach ---------------- */}
        <section className="v3-kit-section" aria-labelledby="k-reach">
          <h2 className="v3-kit-h2" id="k-reach">
            Reach
          </h2>
          <p className="v3-kit-statement">
            {audience.followers ? (
              <>
                <b>{compact(audience.followers)}</b> people follow along.{' '}
              </>
            ) : null}
            {reachLine ? (
              <>
                In the last 30 days the work reached <b>{reachLine}</b> accounts
                {topLine ? (
                  <>
                    {' '}— the top reel alone reached <b>{topLine}</b>
                  </>
                ) : null}
                {engage ? (
                  <>
                    , and <b>{engage}</b> of the people it reached engaged
                  </>
                ) : null}
                .
              </>
            ) : null}
          </p>
        </section>

        {/* ---------------- Best work, playable ---------------- */}
        {audience.top.length ? (
          <section className="v3-kit-section" aria-labelledby="k-work">
            <h2 className="v3-kit-h2" id="k-work">
              Recent work
            </h2>
            <PostGrid posts={audience.top} limit={6} circleFirst={world === 'contact'} />
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
