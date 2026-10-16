// Small server-rendered pieces shared by both Site analytics pages (Landing page, Link page).
// Styles are the lk-* rules in app/(app)/links/links.css.
import type { Count } from '@/lib/hello-insights'
import { RANGES } from '@/lib/hello-stats'
import { readVersion } from '@/lib/v3/version'
import { v3Fonts } from '@/app/_v3/fonts'

export const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–')
export const fmt = (n: number) => n.toLocaleString('en-MY')

export function Bars({ rows, of }: { rows: Count[]; of: number }) {
  const top = Math.max(1, ...rows.map(r => r.count))
  return rows.length ? (
    <ol className="lk-bars">
      {rows.map(r => (
        <li key={r.id}>
          <span className="lk-bar-label" title={r.label}>{r.label}</span>
          <span className="lk-bar-track"><span className="lk-bar-fill" style={{ width: `${(r.count / top) * 100}%` }} /></span>
          <b>{fmt(r.count)}</b>
          <small>{pct(r.count, of)}</small>
        </li>
      ))}
    </ol>
  ) : <p className="v3-empty">Nothing yet in this range.</p>
}

export function Panel({ id, title, note, span = 6, children }: { id: string; title: string; note: string; span?: 4 | 6 | 12; children: React.ReactNode }) {
  return (
    <section className={`v3-panel v3-span-${span}`} aria-labelledby={id}>
      <div className="v3-panel-head">
        <h2 className="v3-panel-title" id={id}>{title}</h2>
        <p className="v3-panel-note">{note}</p>
      </div>
      {children}
    </section>
  )
}

export function Kpis({ label, items }: { label: string; items: { n: number; l: string; s: string }[] }) {
  return (
    <section className="v3-panel v3-span-12 lk-kpis" aria-label={label}>
      {items.map(k => (
        <div key={k.l} className="lk-kpi">
          <span>{k.l}</span>
          <b>{fmt(k.n)}</b>
          <small>{k.s}</small>
        </div>
      ))}
    </section>
  )
}

export function Daily({ daily, days }: { daily: { day: string; visitors: number }[]; days: number }) {
  const peak = Math.max(1, ...daily.map(d => d.visitors))
  return (
    <Panel id="an-day" title="Visitors per day" note={`Last ${days} days · Malaysia time`} span={12}>
      <ol className={`lk-days${days > 30 ? ' lk-days-dense' : ''}`}>
        {daily.map(d => (
          <li key={d.day} title={`${d.day}: ${d.visitors} visitor${d.visitors === 1 ? '' : 's'}`}>
            <span style={{ height: `${(d.visitors / peak) * 100}%` }} />
          </li>
        ))}
      </ol>
      <p className="lk-days-axis"><span>{daily[0]?.day}</span><span>peak {fmt(daily.some(d => d.visitors) ? peak : 0)} a day</span><span>{daily.at(-1)?.day}</span></p>
    </Panel>
  )
}

/** "Reached" rows (scrolled this far, stayed this long) as bars against all visitors. */
export function Reached({ rows, of }: { rows: { id: string; label: string; visitors: number }[]; of: number }) {
  return <Bars rows={rows.map(r => ({ id: r.id, label: r.label, count: r.visitors }))} of={of} />
}

/** The 7/30/90-day choice from ?days= (30 when missing or unknown). */
export async function rangeOf(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const q = await searchParams
  const asked = Number(Array.isArray(q.days) ? q.days[0] : q.days)
  return (RANGES as readonly number[]).includes(asked) ? asked : 30
}

/** Page frame: title, lede, range switch, grid — and the v3 wrapper for the classic layouts. */
export async function Frame({ title, lede, base, days, children }: { title: string; lede: React.ReactNode; base: string; days: number; children: React.ReactNode }) {
  const { version } = await readVersion()
  const page = (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">{title}</h1>
          <p className="v3-lede">{lede} Your own visits and bots are never counted.</p>
        </div>
        <nav className="v3-seg lk-range" aria-label="Range">
          {RANGES.map(r => (
            <a key={r} href={`${base}?days=${r}`} aria-current={r === days ? 'page' : undefined} className={r === days ? 'is-on' : ''}>{r} days</a>
          ))}
        </nav>
      </header>
      <div className="v3-grid">{children}</div>
    </div>
  )
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
