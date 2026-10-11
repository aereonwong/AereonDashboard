// 👉 /hello — the link in Aereon's Instagram bio. Public, phone-first, one screen:
// who he is, every channel as an icon, the collab email up front, then a short list
// of links, then affiliate gear. Text, topics and links are edited on the Link page tab (/links) and read
// from one settings row (lib/hello.ts); the channels come from lib/socials.ts.
//
// Design rules borrowed from Linktree-style pages and kept on purpose:
//   • the main ask (collab email) and all socials sit above the fold on a phone;
//   • one column, big tap targets (≥ 48px), nothing to learn;
//   • the intro motion is CSS only, done in under a second, never blocks a tap,
//     and switches off for prefers-reduced-motion.
import type { Metadata, Viewport } from 'next'
import { readHello } from '@/lib/hello'
import { collabMailto } from '@/lib/hello-config'
import { socials, combined } from '@/lib/socials'
import { EMAIL, OG_IMAGE } from '@/lib/agent-site'
import { GLYPH } from '@/app/_components/SocialLinks'
import CopyText from './CopyText'
import './hello.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Aereon Wong · Links',
  description: 'Tech & travel creator and drone pilot in Kuala Lumpur. All channels, and the email for brand collaborations.',
  alternates: { canonical: '/hello' },
  openGraph: { title: 'Aereon Wong · Links', url: '/hello', images: [{ url: OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height }] },
}

export const viewport: Viewport = { themeColor: '#0B0D12' }

const compact = (n: number) => (n >= 1_000 ? `${Math.round(n / 1000)}K` : String(n))

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
)

export default async function Hello() {
  const cfg = await readHello()
  const channels = socials()
  const total = combined(channels)
  const links = cfg.links.filter(l => l.on)
  const gear = cfg.affiliates.filter(a => a.on)
  // Stagger index for the intro: each block arrives a beat after the one above it.
  let beat = 0
  const step = () => ({ '--i': beat++ } as React.CSSProperties)

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
          {total ? (
            <p className="hl-proof hl-in" style={step()}>
              <b>{compact(total)}</b> followers across {channels.length} platforms
            </p>
          ) : null}
        </header>

        <nav className="hl-socials hl-in" style={step()} aria-label="Follow Aereon">
          {channels.map(s => (
            <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} ${s.handle}`} title={s.name}>
              <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {GLYPH[s.key]}
              </svg>
            </a>
          ))}
        </nav>

        <section className="hl-collab hl-in" style={step()} aria-labelledby="hl-collab-title">
          <p className="hl-kicker">For brands</p>
          <h2 id="hl-collab-title">{cfg.collabTitle}</h2>
          <p className="hl-note">{cfg.collabNote}</p>
          <a className="hl-primary" href={collabMailto(EMAIL)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" />
            </svg>
            <span>Email for a collab</span>
          </a>
          {cfg.topics.length ? (
            <div className="hl-topics" role="group" aria-label="Or pick what you need">
              {cfg.topics.map(t => (
                <a key={t} href={collabMailto(EMAIL, t)}>{t}</a>
              ))}
            </div>
          ) : null}
          <CopyText text={EMAIL} label="the collab email" />
        </section>

        {links.length ? (
          <ul className="hl-links">
            {links.map(l => (
              <li key={l.id} className="hl-in" style={step()}>
                <a href={l.url} target={l.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
                  <span className="hl-link-text">
                    <b>{l.label}</b>
                    {l.note ? <small>{l.note}</small> : null}
                  </span>
                  <Arrow />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {gear.length ? (
          <section className="hl-gear hl-in" style={step()} aria-labelledby="hl-gear-title">
            <h2 id="hl-gear-title">{cfg.affiliateTitle}</h2>
            <p className="hl-disclose">{cfg.affiliateNote}</p>
            <ul>
              {gear.map(a => (
                <li key={a.id}>
                  <a href={a.url} target="_blank" rel="sponsored noopener noreferrer">
                    <span className="hl-link-text">
                      <b>{a.label}</b>
                      {a.note ? <small>{a.note}</small> : null}
                    </span>
                    <Arrow />
                  </a>
                  {a.code ? <CopyText text={a.code} className="hl-code" label={`the code for ${a.label}`} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="hl-foot">
          SY Creative Production · <a href="/">aereonwong.com</a>
        </footer>
      </div>
    </main>
  )
}
