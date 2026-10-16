import type { ReactNode } from 'react'
import './filterbar.css'

// 👉 A v3 panel that says, in its corner, which filters of the page's filter bar it follows
// (docs/FILTER-BAR.md). Server-safe: no hooks, so server and client pages both use it.

/** The dashed chip: "All filters", "Ignores format", "Account-wide · ignores filters". */
export function Scope({ children }: { children: ReactNode }) {
  return <span className="v3-scope">{children}</span>
}

export default function ScopedPanel({
  id,
  title,
  note,
  scope,
  span,
  className = '',
  children,
}: {
  id: string
  title: string
  note?: ReactNode
  scope: ReactNode
  span: number
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`v3-panel v3-span-${span} ${className}`.trim()} aria-labelledby={`p-${id}`}>
      <div className="v3-scoped-head">
        <div>
          <h2 className="v3-panel-title" id={`p-${id}`}>
            {title}
          </h2>
          {note ? <p className="v3-panel-note">{note}</p> : null}
        </div>
        <Scope>{scope}</Scope>
      </div>
      {children}
    </section>
  )
}
