'use client'
import { LIMITS, cleanUrl, type HelloLink, type AffiliateKind } from '@/lib/hello-config'

// One ordered list of links on the Link page tab — used for the plain links and for the
// affiliate links (which add a discount-code field). Add, edit, hide, reorder, delete.

type Row = HelloLink & { code?: string; kind?: AffiliateKind }

export const newRow = (withCode: boolean): Row =>
  ({ id: `l${Date.now().toString(36)}`, label: '', url: '', note: '', on: true, ...(withCode ? { code: '', kind: 'deal' as AffiliateKind } : {}) })

export default function ListEditor<T extends Row>({ rows, onChange, max, withCode, disabled, addLabel }: {
  rows: T[]
  onChange: (rows: T[]) => void
  max: number
  withCode?: boolean
  disabled: boolean
  addLabel: string
}) {
  const edit = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <>
      {rows.length ? (
        <ol className={`lk-list${withCode ? ' lk-list-code' : ''}`}>
          {rows.map((l, i) => (
            <li key={l.id} className={l.on ? '' : 'lk-off'}>
              <label className="lk-on" title={l.on ? 'Shown' : 'Hidden'}>
                <input type="checkbox" checked={l.on} onChange={e => edit(i, { on: e.target.checked })} disabled={disabled} />
                <span className="sr-only">Show {l.label || 'this link'}</span>
              </label>
              <label className="v3-field"><span>Label</span>
                <input className="v3-input" maxLength={LIMITS.label} value={l.label} onChange={e => edit(i, { label: e.target.value })} disabled={disabled} />
              </label>
              <label className="v3-field"><span>Link</span>
                <input className="v3-input" inputMode="url" placeholder="https://" maxLength={LIMITS.url} value={l.url}
                  aria-invalid={!!l.url.trim() && !cleanUrl(l.url)} onChange={e => edit(i, { url: e.target.value })} disabled={disabled} />
              </label>
              <label className="v3-field"><span>Small note (optional)</span>
                <input className="v3-input" maxLength={LIMITS.note} value={l.note} onChange={e => edit(i, { note: e.target.value })} disabled={disabled} />
              </label>
              {withCode ? (
                <label className="v3-field"><span>Section</span>
                  <select className="v3-select" value={l.kind ?? 'deal'} onChange={e => edit(i, { kind: e.target.value as AffiliateKind })} disabled={disabled}>
                    <option value="deal">Attractions &amp; promos</option>
                    <option value="gear">Gear</option>
                  </select>
                </label>
              ) : null}
              {withCode ? (
                <label className="v3-field"><span>Discount code (optional)</span>
                  <input className="v3-input lk-code" maxLength={LIMITS.code} value={l.code ?? ''} onChange={e => edit(i, { code: e.target.value })} disabled={disabled} />
                </label>
              ) : null}
              <div className="lk-row-btns">
                <button type="button" className="v3-btn" onClick={() => move(i, -1)} disabled={i === 0 || disabled} aria-label={`Move ${l.label} up`}>↑</button>
                <button type="button" className="v3-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1 || disabled} aria-label={`Move ${l.label} down`}>↓</button>
                <button type="button" className="v3-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))} disabled={disabled} aria-label={`Delete ${l.label}`}>Delete</button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {rows.length < max ? (
        <button type="button" className="v3-btn" style={{ marginTop: rows.length ? 'var(--space-3)' : 0 }} disabled={disabled}
          onClick={() => onChange([...rows, newRow(!!withCode) as T])}>
          + {addLabel}
        </button>
      ) : null}
    </>
  )
}
