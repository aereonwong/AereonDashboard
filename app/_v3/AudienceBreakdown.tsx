import type { AudienceView, Share } from '@/lib/instagram'

// 👉 Who follows: age, gender, top cities and countries, straight from Instagram's
// follower demographics. Shared by the Instagram tab and media kit v2. Bars carry
// --i so a parent that animates entrances can stagger them; on their own they
// simply render at full length.

export default function AudienceBreakdown({ view }: { view: AudienceView }) {
  const ages = view.ages
  const ageMax = Math.max(...ages.map(a => a.pct), 1)
  const women = view.genders.find(g => g.key === 'F')
  const men = view.genders.find(g => g.key === 'M')
  const stated = (women?.value ?? 0) + (men?.value ?? 0)
  const pctOf = (v: number) => Math.round((v / stated) * 100)

  return (
    <>
      {ages.length ? (
        <div className="v3-k2-panel v3-k2-ages">
          <h3>Age</h3>
          <div className="v3-k2-age-bars">
            {ages.map((a, i) => (
              <div key={a.key} className="v3-k2-age" data-top={a.key === view.topAge?.key || undefined}>
                <span className="v3-k2-age-v">{Math.round(a.pct)}%</span>
                <span className="v3-k2-age-track">
                  <i style={{ ['--h' as string]: (a.pct / ageMax).toFixed(3), ['--i' as string]: i }} />
                </span>
                <span className="v3-k2-age-k">{a.key}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {stated && women && men ? (
        <div className="v3-k2-panel v3-k2-gender">
          <h3>Gender</h3>
          <div className="v3-k2-gender-figs" aria-hidden="true">
            <span>
              <b>{pctOf(men.value)}%</b> men
            </span>
            <span>
              <b>{pctOf(women.value)}%</b> women
            </span>
          </div>
          <div className="v3-k2-split" role="img" aria-label={`${pctOf(men.value)}% men, ${pctOf(women.value)}% women, of followers who state it`}>
            <i style={{ ['--w' as string]: (men.value / stated).toFixed(3) }} />
          </div>
          <p className="v3-k2-fine">Of followers who state it</p>
        </div>
      ) : null}

      <Places title="Top cities" items={view.cities.slice(0, 6)} />
      <Places title="Top countries" items={view.countries.slice(0, 6)} />
    </>
  )
}

function Places({ title, items }: { title: string; items: Share[] }) {
  if (!items.length) return null
  const max = Math.max(...items.map(i => i.pct), 0.1)
  return (
    <div className="v3-k2-panel v3-k2-places">
      <h3>{title}</h3>
      <ol>
        {items.map((it, i) => (
          <li key={it.key}>
            <span className="v3-k2-place">{it.label}</span>
            <span className="v3-k2-place-v">{it.pct.toFixed(1)}%</span>
            <span className="v3-k2-place-bar">
              <i style={{ ['--w' as string]: (it.pct / max).toFixed(3), ['--i' as string]: i }} />
            </span>
          </li>
        ))}
      </ol>
      <p className="v3-k2-fine">Share of all followers</p>
    </div>
  )
}
