'use client'
import { useEffect, useRef, useState } from 'react'

// "What brings you here?" — one tile per audience; picking one opens only its section,
// so the first screen stays short. The open section is in the address (#collab, #shoot,
// #drone, #deals, #gear), so a Story can link straight to it and Back closes it again.
// Without JavaScript the tiles are plain #links and CSS :target opens the section.

export type Audience = { id: string; icon: keyof typeof ICON; title: string; sub: string; panel: React.ReactNode }

const ICON = {
  spark: <><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.8L12 18l-1.7-5.5L4.8 10.7 10.3 9 12 3.5Z" /><path d="M19 4.5v3M17.5 6h3" /></>,
  camera: <><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="12" cy="13.5" r="3.6" /><path d="M8.5 7 10 4.5h4L15.5 7" /></>,
  drone: <><circle cx="5.5" cy="6" r="2.5" /><circle cx="18.5" cy="6" r="2.5" /><circle cx="5.5" cy="18" r="2.5" /><circle cx="18.5" cy="18" r="2.5" /><path d="m7.5 7.8 2.5 2.4M16.5 7.8 14 10.2M7.5 16.2l2.5-2.4M16.5 16.2 14 13.8" /><rect x="9.5" y="9.5" width="5" height="5" rx="1.5" /></>,
  ticket: <><path d="M3.5 8.5V6.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5Z" /><path d="M14.5 5.5v13" strokeDasharray="2 2" /></>,
  bag: <><rect x="4" y="7.5" width="16" height="13" rx="3" /><path d="M8.5 7.5V6a3.5 3.5 0 0 1 7 0v1.5" /><path d="M4 12.5h16" /></>,
}

const Glyph = ({ name }: { name: Audience['icon'] }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {ICON[name]}
  </svg>
)

export default function Chooser({ audiences, style }: { audiences: Audience[]; style?: React.CSSProperties }) {
  const [open, setOpen] = useState<string | null>(null)
  const panels = useRef<Record<string, HTMLElement | null>>({})
  const ids = audiences.map(a => a.id)

  const reveal = (id: string) => requestAnimationFrame(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panels.current[id]?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' })
  })

  // Follow the address: a deep link (/hello#deals) on arrival, and Back/Forward after.
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1)
      setOpen(ids.includes(h) ? h : null)
      if (ids.includes(h)) reveal(h)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join()])

  const pick = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    if (open === id) {
      setOpen(null)
      history.replaceState(null, '', window.location.pathname + window.location.search)
      return
    }
    setOpen(id)
    history.pushState(null, '', `#${id}`)
    reveal(id)
  }

  return (
    <section className="hl-choose hl-in" style={style} aria-labelledby="hl-choose-title">
      <h2 id="hl-choose-title" className="hl-choose-title">What brings you here?</h2>
      <div className="hl-tiles">
        {audiences.map(a => (
          <a
            key={a.id}
            id={`tile-${a.id}`}
            href={`#${a.id}`}
            className={`hl-tile hl-tile-${a.id}${open === a.id ? ' is-open' : ''}`}
            aria-expanded={open === a.id}
            aria-controls={a.id}
            data-t={open === a.id ? undefined : `tap/${a.id}`}
            onClick={e => pick(e, a.id)}
          >
            <Glyph name={a.icon} />
            <span>
              <b>{a.title}</b>
              <small>{a.sub}</small>
            </span>
          </a>
        ))}
      </div>
      {audiences.map(a => (
        <section
          key={a.id}
          id={a.id}
          ref={el => { panels.current[a.id] = el }}
          className={`hl-panel hl-panel-${a.id}`}
          role="region"
          aria-labelledby={`tile-${a.id}`}
          hidden={open !== a.id}
        >
          {a.panel}
        </section>
      ))}
    </section>
  )
}
