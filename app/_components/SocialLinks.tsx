import { socials, combined, SOCIALS_AS_OF, type Social } from '@/lib/socials'

// 👉 Aereon's channels as a row of links with follower counts — the landing page
// and both media kits. Drawn over dark photography, so it uses fixed white-on-glass
// colours (the .so-* rules in globals.css) rather than theme tokens.

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n)

const asOf = new Date(`${SOCIALS_AS_OF}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const GLYPH: Record<Social['key'], React.ReactNode> = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  tiktok: <><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2.2 4.4 5 4.6" /></>,
  facebook: <path d="M14.5 21v-7h2.6l.4-3.2h-3V8.9c0-.9.3-1.6 1.6-1.6h1.6V4.5a20 20 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.3H8.7V14h2.6v7" />,
  threads: <path d="M16.8 11.2c-.4-2.6-2-3.9-4.3-3.9-2.6 0-4.4 2-4.4 4.7s1.8 4.7 4.6 4.7c2.4 0 4-1.4 4-3.4 0-2.1-1.8-3-4-3-1.6 0-2.7.8-2.7 2 0 1 .9 1.8 2.2 1.8 2.5 0 3.3-2 3.3-4.4 0-4.1-2.7-6.7-6.6-6.7C4.9 3 3 6.9 3 12s1.9 9 8 9c3.4 0 5.6-1.4 6.9-3.6" />,
  youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.2 5 2.8-5 2.8Z" /></>,
  xhs: <><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M7.5 9h9M7.5 12h9M7.5 15h5" /></>,
}

export default function SocialLinks({ igFollowers, total = true }: { igFollowers?: number; total?: boolean }) {
  const list = socials(igFollowers)
  const sum = combined(list)
  const counted = list.filter(s => s.followers).length
  return (
    <div className="so">
      {total && sum ? (
        <p className="so-total">
          <b>{compact(sum)}</b> combined followers across {counted} platforms
        </p>
      ) : null}
      <ul className="so-list">
        {list.map(s => (
          <li key={s.key}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} — ${s.handle}${s.followers ? `, ${compact(s.followers)} followers` : ''}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {GLYPH[s.key]}
              </svg>
              <span className="so-name">{s.name}</span>
              {s.followers ? <b className="so-count">{compact(s.followers)}</b> : <span className="so-go">Watch</span>}
            </a>
          </li>
        ))}
      </ul>
      <p className="so-fine">
        Instagram live; other counts as of {asOf}. Someone following on two platforms is counted on both.
      </p>
    </div>
  )
}
