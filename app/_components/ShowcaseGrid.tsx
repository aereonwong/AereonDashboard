import data from '@/lib/showcase.json'
import type { Showcase, ShowcaseItem } from '@/lib/showcase'

// 👉 Work across every kind Aereon makes — product, car and hotel reviews, events,
// aerial and travel — picked from two years of posts by `npm run ig:archive`
// (lib/showcase.ts says how). Used by the landing page and both media kits.
// Covers are saved locally, so nothing here can expire.

export const showcase = data as Showcase

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1000)}K` : String(n)

export default function ShowcaseGrid({ items = showcase.items, limit = 10 }: { items?: ShowcaseItem[]; limit?: number }) {
  const shown = items.slice(0, limit)
  if (!shown.length) return null
  return (
    <ul className="sc-grid" style={{ ['--n' as string]: Math.min(5, shown.length) }}>
      {shown.map(p => (
        <li key={p.id}>
          <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={`${p.label} — open on Instagram: ${p.caption.slice(0, 80)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.cover} alt="" loading="lazy" />
            <span className="sc-label">{p.label}</span>
            {p.showReach && (p.views ?? p.reach) ? (
              <span className="sc-reach">
                <b>{compact((p.views ?? p.reach)!)}</b> {p.views ? 'views' : 'reached'}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  )
}
