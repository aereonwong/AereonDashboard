// Small server-rendered pieces shared by both Site analytics views (Landing, Link page).
// Styles are the lk-* rules in app/(app)/links/links.css.
import type { Count } from '@/lib/hello-insights'

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
