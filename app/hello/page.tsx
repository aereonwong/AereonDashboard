// 👉 /hello — the link in Aereon's Instagram bio. Public, phone-first. The first screen is
// short on purpose: who he is, every channel as an icon, then "What brings you here?" — five
// audiences (brand collab, photo & video, drone pilot, attractions & promos, gear). Picking
// one opens only that section (Chooser.tsx), and each has its own address (/hello#deals…)
// for Stories. Text, topics and links are edited on the Link page tab (/links) and read from
// one settings row (lib/hello.ts); the channels come from lib/socials.ts.
//
// Design rules borrowed from Linktree-style pages and kept on purpose:
//   • socials and the audience choice sit above the fold on a phone; nothing long to scroll;
//   • one column, big tap targets (≥ 48px), nothing to learn;
//   • the intro motion is CSS only, done in under a second, never blocks a tap,
//     and switches off for prefers-reduced-motion.
import type { Metadata, Viewport } from 'next'
import { readHello } from '@/lib/hello'
import { briefMailto, collabMailto, type HelloAffiliate } from '@/lib/hello-config'
import { socials, combined } from '@/lib/socials'
import { socialTotals } from '@/lib/social-totals'
import { EMAIL } from '@/lib/agent-site'
import { GLYPH } from '@/app/_components/SocialLinks'
import CopyText from './CopyText'
import Chooser, { type Audience } from './Chooser'
import TapTracker from './TapTracker'
import { EngagementTracker } from '@/app/_components/LandingTracker'
import './hello.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Aereon Wong · Links',
  description: 'Tech & travel creator and drone pilot in Kuala Lumpur. Brand collabs, photo & video shoots, drone work, attraction promos and gear.',
  alternates: { canonical: '/hello' },
  // The share image is app/hello/opengraph-image.tsx (photo, name, live stats); twitter-image reuses it.
  openGraph: { title: 'Aereon Wong · Links', url: '/hello' },
  twitter: { card: 'summary_large_image', title: 'Aereon Wong · Links' },
}

export const viewport: Viewport = { themeColor: '#0B0D12' }

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1_000 ? `${Math.round(n / 1000)}K` : String(n)

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
)

const Mail = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" />
  </svg>
)

/** One affiliate list (deals or gear): disclosure, sponsored links, copyable codes. */
function AffiliateList({ items, note }: { items: HelloAffiliate[]; note: string }) {
  return (
    <>
      {note ? <p className="hl-disclose">{note}</p> : null}
      <ul className="hl-aff">
        {items.map(a => (
          <li key={a.id}>
            <a href={a.url} target="_blank" rel="sponsored noopener noreferrer" data-t={`out/${a.id}`}>
              <span className="hl-link-text">
                <b>{a.label}</b>
                {a.note ? <small>{a.note}</small> : null}
              </span>
              <Arrow />
            </a>
            {a.code ? <CopyText text={a.code} className="hl-code" label={`the code for ${a.label}`} t={`out/code-${a.id}`} /> : null}
          </li>
        ))}
      </ul>
    </>
  )
}

export default async function Hello() {
  // Overall figures across every platform over the last 90 days, from the stored history
  // (refreshed by the daily cron), never a live call. A platform whose figures are over a
  // week old drops out of the totals (lib/social-totals.ts).
  const [cfg, t] = await Promise.all([readHello(), socialTotals()])
  const channels = socials(t.followers.instagram, t.followers.facebook, t.followers.tiktok)
  const total = combined(channels)
  const links = cfg.links.filter(l => l.on)
  const deals = cfg.affiliates.filter(a => a.on && a.kind === 'deal')
  const gear = cfg.affiliates.filter(a => a.on && a.kind === 'gear')
  // Stagger index for the intro: each block arrives a beat after the one above it.
  let beat = 0
  const step = () => ({ '--i': beat++ } as React.CSSProperties)

  const audiences: Audience[] = [
    {
      id: 'collab', icon: 'spark', title: 'Brand Collab', sub: 'Tech Reviews, Travel Campaigns, and Other Collabs',
      panel: (
        <>
          <p className="hl-kicker">For brands</p>
          <h2>{cfg.collabTitle}</h2>
          <p className="hl-note">{cfg.collabNote}</p>
          <a className="hl-primary" href={collabMailto(EMAIL)} data-t="out/mail-collab"><Mail /><span>Email for a collab</span></a>
          {cfg.topics.length ? (
            <div className="hl-topics" role="group" aria-label="Or pick what you need">
              {cfg.topics.map(t => <a key={t} href={collabMailto(EMAIL, t)} data-t="out/mail-topic">{t}</a>)}
            </div>
          ) : null}
          <CopyText text={EMAIL} label="the email address" t="out/copy-email" />
          {links.length ? (
            <ul className="hl-links">
              {links.map(l => (
                <li key={l.id}>
                  <a href={l.url} target={l.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer" data-t={`out/${l.id}`}>
                    <span className="hl-link-text"><b>{l.label}</b>{l.note ? <small>{l.note}</small> : null}</span>
                    <Arrow />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ),
    },
    {
      id: 'shoot', icon: 'camera', title: 'Photographer or Videographer Service', sub: 'Visitors & local brands',
      panel: (
        <>
          <p className="hl-kicker">Book a shoot</p>
          <h2>Photographer or Videographer Service</h2>
          <p className="hl-note">{cfg.shootNote}</p>
          <div className="hl-split">
            <a className="hl-option" href={briefMailto(EMAIL, 'visitor')} data-t="out/mail-visitor">
              <b>Visiting Kuala Lumpur</b>
              <small>Travel portraits for you, your partner or family at the city&rsquo;s best spots</small>
              {cfg.shootFrom ? <em className="hl-price">{cfg.shootFrom}</em> : null}
              <span>Ask for a shoot <Arrow /></span>
            </a>
            <a className="hl-option" href={briefMailto(EMAIL, 'business')} data-t="out/mail-business">
              <b>Local business</b>
              <small>Product, food, venue and event photos and video for your brand</small>
              <span>Get a quote <Arrow /></span>
            </a>
          </div>
          <CopyText text={EMAIL} label="the email address" t="out/copy-email" />
        </>
      ),
    },
    {
      id: 'drone', icon: 'drone', title: 'Drone Pilot', sub: 'Aerial photo & video',
      panel: (
        <>
          <p className="hl-kicker">Aerial</p>
          <h2>Hire a Drone Pilot</h2>
          <p className="hl-note">{cfg.droneNote}</p>
          <a className="hl-primary" href={briefMailto(EMAIL, 'drone')} data-t="out/mail-drone"><Mail /><span>Send the job details</span></a>
          <CopyText text={EMAIL} label="the email address" t="out/copy-email" />
        </>
      ),
    },
    ...(deals.length ? [{
      id: 'deals', icon: 'ticket', title: cfg.dealsTitle, sub: 'Tickets & deals',
      panel: (<><p className="hl-kicker">Promos</p><h2>{cfg.dealsTitle}</h2><AffiliateList items={deals} note={cfg.affiliateNote} /></>),
    } satisfies Audience] : []),
    ...(gear.length ? [{
      id: 'gear', icon: 'bag', title: cfg.affiliateTitle, sub: 'Kit links & codes',
      panel: (<><p className="hl-kicker">Gear</p><h2>{cfg.affiliateTitle}</h2><AffiliateList items={gear} note={cfg.affiliateNote} /></>),
    } satisfies Audience] : []),
  ]

  return (
    <main className="hl">
      <div className="hl-col">
        <header className="hl-hero">
          <div className="hl-band" aria-hidden="true">
            <img src="/img/klcc-sunset.jpg" alt="" width={2000} height={1332} fetchPriority="high" decoding="async" />
            {/* The signature: a drone's flight line drawing itself across the skyline. */}
            <svg className="hl-flight" viewBox="0 0 400 150" preserveAspectRatio="none">
              <path pathLength={1} d="M-10 128 C 70 120, 110 70, 190 74 S 320 30, 410 18" />
            </svg>
          </div>
          <img className="hl-avatar" src="/img/aereon.jpg" alt="Aereon Wong" width={760} height={900} />
          <h1 className="hl-name hl-in" style={step()}>Aereon Wong</h1>
          <p className="hl-tag hl-in" style={step()}>{cfg.tagline}</p>
          <dl className="hl-stats hl-in" style={step()}>
            {t.views ? <div><dt>Views</dt><dd>{compact(t.views)}</dd><small>All socials · 90 days</small></div> : null}
            {t.interactions ? <div><dt>Interactions</dt><dd>{compact(t.interactions)}</dd><small>All socials · 90 days</small></div> : null}
            {total ? <div><dt>Followers</dt><dd>{compact(total)}</dd><small>{channels.length} platforms</small></div> : null}
          </dl>
        </header>

        <nav className="hl-socials hl-in" style={step()} aria-label="Follow Aereon">
          {channels.map(s => (
            <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} ${s.handle}`} title={s.name} data-t={`out/social-${s.key}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {GLYPH[s.key]}
              </svg>
            </a>
          ))}
        </nav>

        <Chooser audiences={audiences} style={step()} />
        <TapTracker />
        <EngagementTracker base="/hello" />

      </div>
    </main>
  )
}
