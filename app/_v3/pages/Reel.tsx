import '../reel.css'
import { v3Fonts } from '../fonts'
import { publicCountries, sharePct, type Audience } from '@/lib/v3/audience'
import type { WorkKind } from '@/lib/invoices'
import { compact, longDate } from '../fmt'
import { KIT_BRANDS, logoSize } from '@/lib/v3/brands'
import ReelFilm, { type ReelData, type ReelPost } from '../ReelFilm'
import { showcase } from '@/app/_components/ShowcaseGrid'
import SocialLinks from '@/app/_components/SocialLinks'
import { socials, combined } from '@/lib/socials'
import { intro as introFor } from '../intro'

// 👉 The motion-reel landing (5 Oct 2026): a third public landing beside the
// Front door and the media kit. It opens on a 30-second motion-graphics film
// (ReelFilm.tsx) that introduces Aereon and ends on "work with me", then the
// same story as a scrollable media kit for anyone who wants the detail.
//
// Same hard rules as the media kits: no client names, no amounts, no private
// business data, and no figure Instagram did not report. Account figures are
// shown only while fresh; a section without data is left out.

const EMAIL = 'aereon.wong@gmail.com'
const IG = 'https://www.instagram.com/aereonwong/'

const SERVICES: Record<WorkKind, { title: string; line: string } | null> = {
  'Drone / aerial': { title: 'Aerial & drone', line: 'Aerial film and photography — skylines, resorts, launches and drone shows.' },
  'Social campaign': { title: 'Social campaigns', line: 'Reels built to travel past the follower base, posted where Malaysia is watching.' },
  'Event coverage': { title: 'Event coverage', line: 'Launches, activations and light shows, covered live and cut the same night.' },
  'Production / licensing': { title: 'Production & licensing', line: 'Footage produced to brief, and archive aerials licensed for campaigns.' },
  Other: null,
}

/** A short, human label for a post, from the first clause of its caption. */
const label = (caption: string) => {
  const first = caption.replace(/[#@][\w.]+/g, '').split(/[\n.!?🩵🇲🇾✨⚡️🌃🏎️💨🏁]/u)[0]?.trim() ?? ''
  return first.length > 46 ? first.slice(0, 44).trimEnd() + '…' : first
}

export default function Reel({ audience, kinds, since }: { audience: Audience; kinds: WorkKind[]; since: string }) {
  const { view } = audience
  // Instagram's own 30-day account figures — only while fresh (same rule as kit v2).
  const fresh = !!view && Date.now() - Date.parse(view.capturedAt) <= 7 * 86_400_000
  const reach = fresh ? (view?.totals.reach ?? 0) : 0
  const views = fresh ? (view?.totals.views ?? 0) : 0
  const interactions = fresh ? (view?.totals.total_interactions ?? 0) : 0
  // Two years of work, one tile per kind (lib/showcase.ts) — lately the feed is
  // mostly KLCC. The recent best posts are only the fallback.
  const fromShowcase: ReelPost[] = showcase.items
    .filter(p => p.reach !== undefined)
    .map(p => ({ id: p.id, thumb: p.cover, reach: p.reach!, permalink: p.permalink, label: p.label, showReach: p.showReach }))
  const best = audience.best.filter(p => p.thumb && p.permalink && p.reach !== undefined)
  const recent: ReelPost[] = best.slice(0, 10).map(p => ({
    id: p.id,
    thumb: p.thumb!,
    reach: p.reach!,
    permalink: p.permalink,
    label: label(p.caption),
    crop: p.crop ? 1 / Math.max(0.3, 1 - p.crop.t - p.crop.b) : undefined,
  }))
  const intro = introFor(`${Math.floor(combined(socials(audience.followers)) / 1000)}K+`)
  const posts = fromShowcase.length ? fromShowcase : recent
  const workTitle = fromShowcase.length ? 'Work across the board' : undefined
  const brands = KIT_BRANDS.map(b => {
    // The film's wall is a touch larger than the kit's.
    const s = logoSize(b.aspect)
    return { slug: b.slug, name: b.name, w: Math.round(s.w * 1.1), h: Math.round(s.h * 1.1) }
  })
  const data: ReelData = { followers: audience.followers, reach, views, interactions, posts, workTitle, intro, brands, email: EMAIL, ig: IG }
  const services = kinds.map(k => SERVICES[k]).filter(Boolean) as { title: string; line: string }[]
  const women = view?.genders.find(g => /^f/i.test(g.key))
  const men = view?.genders.find(g => /^m/i.test(g.key))
  const updated = view?.capturedAt ?? audience.snap?.captured_at

  return (
    <div className={`v3 rl ${v3Fonts}`} data-world="canon">
      <header className="rl-top">
        <span className="rl-mark">
          <span className="rl-dot" aria-hidden="true" /> Aereon Wong
        </span>
        <nav aria-label="Contact">
          <a href="#kit">Media kit</a>
          <a href={IG} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={`mailto:${EMAIL}`}>Email</a>
          <a className="rl-login" href="/dashboard">
            Studio login →
          </a>
        </nav>
      </header>

      <h1 className="rl-sr">Aereon Wong — Tech &amp; Travel Content Creator and drone pilot, Kuala Lumpur</h1>
      <ReelFilm data={data} />

      <main className="rl-kit" id="kit">
        <section className="rl-intro" aria-labelledby="rl-hi">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rl-face" src="/img/aereon.jpg" alt="Aereon Wong" />
          <div>
            <p className="rl-eyebrow">Media kit · {updated ? longDate(updated.slice(0, 10)) : 'Kuala Lumpur'}</p>
            <h2 id="rl-hi" className="rl-h2">
              Tech and Travel Content Creator
            </h2>
            {intro.lede.map((t, i) => (
              <p className="rl-lede" key={i}>
                {t}
              </p>
            ))}
          </div>
        </section>

        <section aria-labelledby="rl-num">
          <h2 id="rl-num" className="rl-h2 rl-sec">
            In numbers
          </h2>
          <dl className="rl-stats">
            {audience.followers ? (
              <div>
                <dd className="num">{compact(audience.followers)}</dd>
                <dt>Followers</dt>
              </div>
            ) : null}
            {reach ? (
              <div>
                <dd className="num">{compact(reach)}</dd>
                <dt>Reached · 30 days</dt>
              </div>
            ) : null}
            {views ? (
              <div>
                <dd className="num">{compact(views)}</dd>
                <dt>Views · 30 days</dt>
              </div>
            ) : null}
            {interactions ? (
              <div>
                <dd className="num">{compact(interactions)}</dd>
                <dt>Interactions · 30 days</dt>
              </div>
            ) : null}
          </dl>
        </section>

        <section aria-labelledby="rl-social">
          <h2 id="rl-social" className="rl-h2 rl-sec">
            Find me on
          </h2>
          <SocialLinks igFollowers={audience.followers} />
        </section>

        {view && (view.countries.length || view.ages.length || women || men) ? (
          <section aria-labelledby="rl-aud">
            <h2 id="rl-aud" className="rl-h2 rl-sec">
              Who&rsquo;s watching
            </h2>
            <div className="rl-cards">
              {view.countries.length ? (
                <div className="rl-card">
                  <h3>Where they are</h3>
                  <Shares items={publicCountries(view.countries)} precise />
                </div>
              ) : null}
              {view.ages.length ? (
                <div className="rl-card">
                  <h3>Age</h3>
                  <Shares items={[...view.ages].sort((a, b) => b.pct - a.pct)} />
                </div>
              ) : null}
              {women || men ? (
                <div className="rl-card">
                  <h3>Gender</h3>
                  <p className="rl-gender">
                    {women ? (
                      <span>
                        <b className="num">{Math.round(women.pct)}%</b> women
                      </span>
                    ) : null}
                    {men ? (
                      <span>
                        <b className="num">{Math.round(men.pct)}%</b> men
                      </span>
                    ) : null}
                  </p>
                  {view.cities[0] ? <p className="rl-note">Top city: {view.cities[0].label}</p> : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {posts.length ? (
          <section aria-labelledby="rl-work">
            <h2 id="rl-work" className="rl-h2 rl-sec">
              {workTitle ?? 'Recent best work'}
            </h2>
            <ul className="rl-posts">
              {posts.map(p => (
                <li key={p.id}>
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open on Instagram: ${p.label}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt="" loading="lazy" style={p.crop ? { transform: `scale(${p.crop})` } : undefined} />
                    <span>
                      {p.showReach === false ? (
                        p.label
                      ) : (
                        <>
                          <b className="num">{compact(p.reach)}</b> reached · {p.label}
                        </>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {services.length ? (
          <section aria-labelledby="rl-make">
            <h2 id="rl-make" className="rl-h2 rl-sec">
              What I make
            </h2>
            <div className="rl-cards">
              {services.map(s => (
                <div className="rl-card" key={s.title}>
                  <h3>{s.title}</h3>
                  <p className="rl-note">{s.line}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="rl-brands">
          <h2 id="rl-brands" className="rl-h2 rl-sec">
            Brands I&rsquo;ve made work for
          </h2>
          <ul className="rl-logos">
            {KIT_BRANDS.map(b => (
              <li key={b.slug} title={`${b.name} · ${b.kind}`}>
                <span
                  className="rl-logo"
                  role="img"
                  aria-label={b.name}
                  style={{ ['--logo' as string]: `url(/img/brands/${b.slug}.svg)`, width: logoSize(b.aspect).w, height: logoSize(b.aspect).h }}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="rl-close" aria-labelledby="rl-hello">
          <h2 id="rl-hello" className="rl-h2">
            Let&rsquo;s make something that travels.
          </h2>
          <p className="rl-lede">Launches, landmarks, hotels and events — tell me the brief and the date.</p>
          <div className="rl-ctas">
            <a className="rf-btn solid" href={`mailto:${EMAIL}?subject=Collaboration`}>
              {EMAIL}
            </a>
            <a className="rf-btn ghost" href={IG} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          </div>
        </section>
      </main>

      <footer className="rl-foot">
        <span>SY Creative Production Sdn. Bhd.</span>
        <span>Aerial · Travel · Tech · Hotels · Events</span>
        <span>{updated ? `Instagram figures as of ${longDate(updated.slice(0, 10))}` : 'Photos: Aereon Wong · Kuala Lumpur'}</span>
      </footer>
    </div>
  )
}

function Shares({ items, precise }: { items: { key: string; label: string; pct: number }[]; precise?: boolean }) {
  const top = items.slice(0, 4)
  const peak = Math.max(1, ...top.map(s => s.pct))
  return (
    <ul className="rl-share">
      {top.map(s => (
        <li key={s.key}>
          <span>{s.label}</span>
          <i aria-hidden="true" style={{ ['--w' as string]: (s.pct / peak).toFixed(3) }} />
          <b className="num">{precise ? sharePct(s.pct) : Math.round(s.pct)}%</b>
        </li>
      ))}
    </ul>
  )
}
