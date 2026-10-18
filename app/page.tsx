// 👉 The public landing page (the only page outside the passcode). It introduces
// Aereon and links into the locked dashboard. Numbers come from the newest
// Instagram snapshot; the brands come from the invoices, so both stay current
// without anyone editing this file. No client names, amounts or private data.
import { socialTotals } from '@/lib/social-totals'
import { socials, combined } from '@/lib/socials'
import { getRecords } from '@/lib/records'
import { toInvoices } from '@/lib/invoices'
import type { Metadata } from 'next'
import { readSite } from '@/lib/v3/site'
import { readAudience } from '@/lib/v3/audience'
import MediaKit from '@/app/_v3/pages/MediaKit'
import MediaKit2 from '@/app/_v3/pages/MediaKit2'
import Reel from '@/app/_v3/pages/Reel'
import { signedIn as isSignedIn } from '@/lib/auth'
import { jsonLd, EMAIL } from '@/lib/agent-site'
import ShowcaseGrid, { showcase } from '@/app/_components/ShowcaseGrid'
import SocialLinks from '@/app/_components/SocialLinks'
import LandingTracker from '@/app/_components/LandingTracker'

export const dynamic = 'force-dynamic'

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1000)}K` : String(n)

// Brand names worth showing — pulled from invoice project text, not client names.
const BRAND_WORDS = [
  'Petronas', 'HONOR', 'Canon', 'Samsung', 'Xiaomi', 'vivo', 'Tecno', 'Lazada', 'Shopee', 'DHL',
  'Tesla', 'Proton', 'ECCO', 'Anker', 'Ricoh', 'Trip.com', 'Klook', 'Coway', 'Sunlife', 'CIMB',
  'RHB', 'Public Bank', 'Tourism Malaysia', 'Sabah Tourism', 'Singapore Tourism Board', 'KL Tower',
  'Merdeka 118', 'PlayStation', 'MOVA', 'Kaadas', 'Etiqa', 'Tetra Pak',
]

// When the media kit is on, links shared with brands preview as a creator page.
export async function generateMetadata(): Promise<Metadata> {
  const site = await readSite()
  return site.landing === 'kit' || site.landing === 'reel'
    ? {
        alternates: { canonical: '/' },
        title: 'Aereon Wong — Tech and Travel Content Creator',
        description:
          'Kuala Lumpur travel and tech content creator and drone pilot. Aerial films, launch campaigns, hotels and tourism.',
      }
    : { alternates: { canonical: '/' } }
}

// JSON-LD (Person + Organization + WebSite) so machines can read who this is. The `<`
// escape keeps the JSON from ever closing the script tag.
function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\\u003c') }}
    />
  )
}

export default function Landing(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <JsonLd />
      <LandingBody {...props} />
    </>
  )
}

async function LandingBody({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [site, sp, signedIn] = await Promise.all([readSite(), searchParams, isSignedIn()])
  // A private preview, so the kit can be checked before it goes public. Only
  // honoured for someone signed in; everyone else sees the saved setting.
  const preview = signedIn && sp.preview === 'kit'
  const reelPreview = signedIn && sp.preview === 'reel'
  // The motion reel wins only when chosen, or when previewed explicitly.
  if ((site.landing === 'reel' && !preview) || reelPreview) {
    const [audience, recs, totals] = await Promise.all([readAudience(), getRecords(), socialTotals()])
    const inv = toInvoices(recs)
    const kinds = [...new Set(inv.map(i => i.kind))]
    const since = inv.map(i => i.date).sort()[0]?.slice(0, 4) ?? '2021'
    return <><LandingTracker version="reel" /><Reel audience={audience} kinds={kinds} since={since} totals={totals} /></>
  }
  if (site.landing === 'kit' || preview) {
    const [audience, recs, totals] = await Promise.all([readAudience(), getRecords(), socialTotals()])
    const inv = toInvoices(recs)
    const kinds = [...new Set(inv.map(i => i.kind))]
    const since = inv.map(i => i.date).sort()[0]?.slice(0, 4) ?? '2021'
    // Which kit: a signed-in preview can ask for either; visitors get the saved one.
    const kit = preview && (sp.kit === 'v1' || sp.kit === 'v2') ? sp.kit : site.kit
    // Kit v2 is drawn in Studio Standard only — Aereon's chosen look (2 Oct 2026).
    if (kit === 'v2') return <><LandingTracker version="kit-v2" /><MediaKit2 audience={audience} kinds={kinds} since={since} totals={totals} /></>
    return (
      <>
      <LandingTracker version="kit-v1" />
      <MediaKit
        audience={audience}
        brands={[]}
        kinds={kinds}
        since={since}
        totals={totals}
      />
      </>
    )
  }

  const [rows, t] = await Promise.all([getRecords(), socialTotals()])
  // Overall figures across every platform over 90 days, from the stored history
  // (lib/social-totals.ts). A platform over a week stale drops out.
  const channels = socials(t.followers.instagram, t.followers.facebook, t.followers.tiktok)
  const followers = combined(channels)

  const invoices = toInvoices(rows)
  const text = invoices.map(i => `${i.project} ${i.client}`).join(' ')
  const brands = BRAND_WORDS.filter(b => text.toLowerCase().includes(b.toLowerCase())).slice(0, 14)

  return (
    <div className="land">
      <LandingTracker version="classic" />
      <div className="land-photo" aria-hidden="true" />
      <div className="land-scrim" aria-hidden="true" />
      <div className="land-inner">
        <header className="land-top">
          <span className="land-mark">
            <span className="dotmark" aria-hidden="true" /> Aereon Wong
          </span>
          <a className="land-enter" href="/dashboard" data-t="enter-top">
            Enter dashboard
            <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </header>

        <section className="land-hero">
          <div className="land-person">
            <img className="land-face" src="/img/aereon.jpg" alt="Aereon Wong" />
            <div>
              <p className="lp-name">Hi, I'm Aereon Wong.</p>
              <p className="lp-role">Tech &amp; Travel Content Creator · drone pilot · KL</p>
            </div>
          </div>
          <p className="eyebrow">Kuala Lumpur · Malaysia</p>
          <h1>
            Tech and Travel<br />
            <span className="tint">Content Creator</span>
          </h1>
          <p className="blurb">
            Creative visual travel content creator and professional drone pilot. Aerial films, launch
            campaigns, hotels and tourism — from KLCC rooftops to island resorts. Photography, videography
            and the occasional drone show at 300 metres.
          </p>

          <div className="land-stats">
            {followers > 0 ? (
              <div className="land-stat">
                <div className="v">{compact(followers)}</div>
                <div className="l">Followers</div>
              </div>
            ) : null}
            {t.views ? (
              <div className="land-stat">
                <div className="v">{compact(t.views)}</div>
                <div className="l">Views · 90 days</div>
              </div>
            ) : null}
            {t.interactions ? (
              <div className="land-stat">
                <div className="v">{compact(t.interactions)}</div>
                <div className="l">Interactions · 90 days</div>
              </div>
            ) : null}
          </div>

          <div className="land-work">
            <p className="eyebrow" style={{ marginBottom: 10 }}>Find me on</p>
            <SocialLinks igFollowers={t.followers.instagram} fbFollowers={t.followers.facebook} ttFollowers={t.followers.tiktok} />
          </div>

          {/* Product, car and hotel reviews, events, aerial and travel — not just KLCC. */}
          {showcase.items.length ? (
            <div className="land-work">
              <p className="eyebrow" style={{ marginBottom: 10 }}>Work across the board</p>
              <ShowcaseGrid limit={5} />
            </div>
          ) : null}

          {brands.length > 0 ? (
            <>
              <p className="eyebrow" style={{ marginBottom: 10 }}>Brands I&apos;ve worked with</p>
              <div className="land-tags">
                {brands.map(b => (
                  <span className="land-tag" key={b}>{b}</span>
                ))}
              </div>
            </>
          ) : null}

          <div className="land-cta">
            <a className="land-btn solid" href="https://www.instagram.com/aereonwong/" target="_blank" rel="noopener noreferrer">
              <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <path d="M17.5 6.5h.01" />
              </svg>
              @aereonwong
            </a>
            <a className="land-btn ghost" href={`mailto:${EMAIL}?subject=Collaboration`} data-t="mail-cta">
              <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m3.5 7 8.5 6 8.5-6" />
              </svg>
              Work with me
            </a>
            <a className="land-btn ghost" href="/mediakit" data-t="kit-cta">
              <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Media kit
            </a>
            <a className="land-btn ghost" href="/dashboard" data-t="enter-cta">
              <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="11" width="4" height="9" rx="1" />
                <rect x="10" y="6" width="4" height="14" rx="1" />
                <rect x="16" y="14" width="4" height="6" rx="1" />
              </svg>
              Dashboard
            </a>
          </div>

          <footer className="land-foot">
            <span>SY Creative Production Sdn. Bhd.</span>
            <span>Aerial · Travel · Tech · Hotels · Events</span>
            <span>Photos: Aereon Wong · Kuala Lumpur</span>
          </footer>
        </section>
      </div>
    </div>
  )
}
