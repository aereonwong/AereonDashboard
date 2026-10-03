import type { Kpi, Summary } from '@/lib/v3/summary'
import type { StatusFigures } from '@/lib/invoice-figures'
import { withParam, type Filters } from '@/lib/v3/filters'
import Icon from '@/app/_components/Icon'
import { rmFull, compact, money, shortDate } from '../fmt'

// 👉 The panels of v3's Invoice Summary (lib/v3/summary.ts does the counting).
// Server components: plain markup and inline SVG, no functions cross to the client.

const pctTxt = (x: number) => `${Math.round(x * 100)}%`
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`

/** A small trend line under a figure. Shape only — the figure above it is the number. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const W = 120
  const H = 28
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 2 - (v / max) * (H - 4)])
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg className="v3-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${H} ${line} ${W},${H}`} />
      <polyline points={line} />
    </svg>
  )
}

export function DeltaChip({ d, label }: { d: number | null; label?: string }) {
  if (d === null || !Number.isFinite(d)) return null
  const dir = Math.round(d * 100) === 0 ? 'flat' : d > 0 ? 'up' : 'down'
  return (
    <span className={`v3-chip-delta ${dir}`} title={label}>
      {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'} {signed(d)}
    </span>
  )
}

export function KpiCard({ label, value, k, note, prevLabel }: { label: string; value: string; k?: Kpi; note: React.ReactNode; prevLabel?: string }) {
  return (
    <div className="v3-sum-kpi">
      <div className="v3-kpi-label">{label}</div>
      <div className="v3-sum-kpi-row">
        <div className="v3-kpi-value num">{value}</div>
        {k ? <DeltaChip d={k.delta} label={prevLabel} /> : null}
      </div>
      <div className="v3-kpi-note">{note}</div>
      {k ? <Spark values={k.spark} /> : null}
    </div>
  )
}

// ------------------------------------------------------------ Payment & filing

export function PaymentPanel({ s, drive, year, client }: { s: StatusFigures; drive: StatusFigures; year?: string; client?: string }) {
  // The Details list behind each figure: same year (when the range is one year) and client.
  const q = (extra: string) =>
    `/invoices/details?${year ? `year=${year}&` : 'year=&'}${client ? `client=${encodeURIComponent(client)}&` : ''}${extra}`
  const waiting = Math.max(0, s.outstandingRM - s.overdueRM)
  const parts = [
    { id: 'paid', label: 'Paid', rm: s.paidRM, n: s.paidCount, href: q('payment=paid') },
    { id: 'waiting', label: 'Awaiting payment', rm: waiting, n: s.outstandingCount - s.overdueCount, href: q('payment=owed') },
    { id: 'overdue', label: 'Overdue', rm: s.overdueRM, n: s.overdueCount, href: q('payment=overdue') },
    { id: 'untracked', label: 'Not tracked', rm: s.untrackedRM, n: s.untrackedCount, href: q('payment=untracked') },
  ]
  const total = parts.reduce((t, p) => t + p.rm, 0)
  return (
    <div className="v3-pay">
      <div className="v3-pay-bar" role="img" aria-label="Ringgit by payment status">
        {parts.map(p => (p.rm ? <i key={p.id} data-s={p.id} style={{ flexGrow: p.rm }} title={`${p.label}: ${rmFull(p.rm)}`} /> : null))}
      </div>
      <div className="v3-pay-legend">
        {parts.map(p => (
          <a key={p.id} href={p.href} className="v3-pay-item" data-empty={p.n ? undefined : 'true'}>
            <span className="v3-pay-dot" data-s={p.id} aria-hidden="true" />
            <span className="v3-pay-label">{p.label}</span>
            <b className="num">{rmFull(p.rm)}</b>
            <span className="v3-pay-sub">
              {p.n} invoice{p.n === 1 ? '' : 's'}
              {total ? ` · ${pctTxt(p.rm / total)}` : ''}
            </span>
          </a>
        ))}
      </div>
      <a className="v3-pay-drive" href={q('drive=pending')}>
        <Icon name="drive" />
        <span>
          <b className="num">
            {drive.driveUploaded} of {drive.count}
          </b>{' '}
          filed in Google Drive{drive.drivePending ? ` · ${drive.drivePending} waiting` : ' · all filed'}
        </span>
        <span className="v3-pay-meter" aria-hidden="true">
          <i style={{ ['--w' as string]: (drive.count ? drive.driveUploaded / drive.count : 0).toFixed(3) }} />
        </span>
      </a>
    </div>
  )
}

// ----------------------------------------------------------------- Work types

export function WorkTypes({ sum, filters }: { sum: Summary; filters: Filters }) {
  const maxAvg = Math.max(1, ...sum.kinds.map(k => k.avgJob))
  return (
    <div className="v3-kinds">
      <div className="v3-kinds-head" aria-hidden="true">
        <span>Work</span>
        <span className="r">Invoiced</span>
        <span>Rate per job</span>
        <span className="r">Share</span>
      </div>
      {sum.kinds.map(k => (
        <a
          key={k.kind}
          className="v3-kinds-row"
          href={withParam(filters, 'kind', filters.kind === k.kind ? undefined : k.kind)}
          aria-current={filters.kind === k.kind ? 'true' : undefined}
        >
          <span className="v3-kinds-name">
            {k.kind}
            <small>
              {k.count} job{k.count === 1 ? '' : 's'}
            </small>
          </span>
          <span className="r num">{rmFull(k.total)}</span>
          <span className="v3-kinds-rate">
            <i style={{ ['--w' as string]: (k.avgJob / maxAvg).toFixed(3) }} />
            <b className="num">{rmFull(k.avgJob)}</b>
          </span>
          <span className="r num">
            {pctTxt(k.share)}
            {k.shareDelta !== null && Math.round(k.shareDelta * 100) !== 0 ? (
              <small className={k.shareDelta > 0 ? 'up' : 'down'}>
                {k.shareDelta > 0 ? '+' : '−'}
                {Math.abs(Math.round(k.shareDelta * 100))} pts
              </small>
            ) : null}
          </span>
        </a>
      ))}
    </div>
  )
}

export function MixByYear({ sum }: { sum: Summary }) {
  const kinds = sum.kinds.map(k => k.kind)
  const order = [...kinds, ...sum.yearMix[0].parts.map(p => p.kind).filter(k => !kinds.includes(k))]
  return (
    <div className="v3-mix">
      {sum.yearMix.map(y => (
        <div key={y.year} className="v3-mix-row">
          <span className="v3-mix-year num">{y.year}</span>
          <span className="v3-mix-bar" role="img" aria-label={`${y.year} work mix`}>
            {order.map((kind, i) => {
              const p = y.parts.find(x => x.kind === kind)!
              return p.share ? <i key={kind} data-i={i} style={{ flexGrow: p.share }} title={`${kind}: ${pctTxt(p.share)}`} /> : null
            })}
          </span>
          <span className="v3-mix-total num">{y.total ? compact(y.total) : '—'}</span>
        </div>
      ))}
      <div className="v3-mix-key">
        {order.map((kind, i) => (
          <span key={kind}>
            <i data-i={i} aria-hidden="true" /> {kind}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Invoice sizes

export function Sizes({ sum }: { sum: Summary }) {
  const peak = Math.max(0.01, ...sum.sizes.map(b => Math.max(b.countShare, b.totalShare)))
  const carry = [...sum.sizes].sort((a, b) => b.totalShare - a.totalShare)[0]
  return (
    <div className="v3-ins">
      {carry?.total ? (
        <p className="v3-ins-say">
          <b>{carry.label}</b> invoices bring in {pctTxt(carry.totalShare)} of the money from {pctTxt(carry.countShare)} of the
          invoices. Median invoice {rmFull(sum.medianInvoice)}.
        </p>
      ) : null}
      <div className="v3-sizes" role="table" aria-label="Invoices and ringgit by invoice size">
        {sum.sizes.map(b => (
          <div className="v3-sizes-col" role="row" key={b.label}>
            <div className="v3-sizes-bars" aria-hidden="true">
              <i className="n" style={{ ['--h' as string]: (b.countShare / peak).toFixed(3) }} />
              <i className="rm" style={{ ['--h' as string]: (b.totalShare / peak).toFixed(3) }} />
            </div>
            <span role="rowheader" className="v3-sizes-label">
              {b.label}
            </span>
            <span role="cell" className="v3-sizes-num num">
              {b.count} · {pctTxt(b.totalShare)}
            </span>
          </div>
        ))}
      </div>
      <p className="v3-ins-foot">
        <span className="v3-rvw-key reach" /> Share of invoices <span className="v3-rvw-key rm" /> Share of ringgit. RM, ringgit
        invoices only.
      </p>
    </div>
  )
}

// ------------------------------------------------------------ New vs returning

export function Cohorts({ sum }: { sum: Summary }) {
  if (!sum.cohorts.length) return <p className="v3-empty">No ringgit invoices in this range.</p>
  const peak = Math.max(1, ...sum.cohorts.map(c => c.fresh + c.returning))
  // Long ranges: every quarter fits on one line; only every few carry a label.
  const every = Math.max(1, Math.ceil(sum.cohorts.length / 6))
  const shown = (i: number) => (sum.cohorts.length - 1 - i) % every === 0 // count back from the latest quarter, so it is always labelled
  return (
    <div className="v3-ins">
      {sum.newClients && sum.returningShare !== null ? (
        <p className="v3-ins-say">
          <b>{sum.newClients.count}</b> new client{sum.newClients.count === 1 ? '' : 's'} brought {rmFull(sum.newClients.total)};{' '}
          <b>{pctTxt(sum.returningShare)}</b> of the range came from clients you had worked with before.
        </p>
      ) : (
        <p className="v3-ins-say">Over all time every client was new once — pick a shorter range to see who is new and who came back.</p>
      )}
      <div className="v3-cohort" role="table" aria-label="New and returning clients by quarter" style={{ ['--n' as string]: sum.cohorts.length }}>
        {sum.cohorts.map((c, i) => (
          <div className="v3-cohort-col" role="row" key={c.key} title={`${c.label}: ${rmFull(c.fresh + c.returning)}`}>
            <div className="v3-cohort-stack" aria-hidden="true" style={{ ['--h' as string]: ((c.fresh + c.returning) / peak).toFixed(3) }}>
              <i className="ret" style={{ flexGrow: c.returning }} />
              <i className="new" style={{ flexGrow: c.fresh }} />
            </div>
            <span role="rowheader" className="v3-rvw-label">
              {shown(i) ? c.label : <span className="sr-only">{c.label}</span>}
            </span>
            <span role="cell" className="v3-rvw-num">
              {shown(i) ? compact(c.fresh + c.returning) : <span className="sr-only">{compact(c.fresh + c.returning)}</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="v3-ins-foot">
        <span className="v3-rvw-key rm" /> New: the quarter of a client&apos;s first-ever invoice{' '}
        <span className="v3-rvw-key ret" /> Returning: every later quarter.
      </p>
    </div>
  )
}

// --------------------------------------------------------------------- Clients

export function TopClients({ sum, filters }: { sum: Summary; filters: Filters }) {
  if (!sum.topClients.length) return <p className="v3-empty">No clients in this range.</p>
  const top = sum.topClients[0].total || 1
  return (
    <div className="v3-rows">
      {sum.topClients.map(c => (
        <a key={c.client} className="v3-row" href={withParam(filters, 'client', c.client)}>
          <div className="v3-row-main">
            <div className="v3-row-title">
              {c.client}
              {c.isNew ? <span className="v3-tag-new">New</span> : null}
            </div>
            <div className="v3-row-sub">
              {c.count} job{c.count === 1 ? '' : 's'} · {pctTxt(c.share)}
              {c.delta !== null ? ` · ${signed(c.delta)} on the period before` : ''}
            </div>
          </div>
          <div className="v3-row-num">{rmFull(c.total)}</div>
          <div className="v3-row-bar">
            <i style={{ ['--w' as string]: (c.total / top).toFixed(3) }} />
          </div>
        </a>
      ))}
    </div>
  )
}

export function Movers({ sum }: { sum: Summary }) {
  if (!sum.prevFrom) return <p className="v3-empty">Pick a range other than All time to compare with the period before.</p>
  const list = (xs: Summary['movers']['up'], dir: 'up' | 'down') =>
    xs.length ? (
      <div className="v3-rows">
        {xs.map(m => (
          <div className="v3-row" key={m.client}>
            <div className="v3-row-main">
              <div className="v3-row-title">{m.client}</div>
              <div className="v3-row-sub">
                {rmFull(m.before)} → {rmFull(m.now)}
              </div>
            </div>
            <div className={`v3-row-num v3-move ${dir}`}>
              {dir === 'up' ? '+' : '−'}
              {rmFull(Math.abs(m.delta))}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="v3-empty">Nobody {dir === 'up' ? 'grew' : 'dropped'}.</p>
    )
  return (
    <div className="v3-movers">
      <div>
        <h3 className="v3-ins-sub">Growing</h3>
        {list(sum.movers.up, 'up')}
      </div>
      <div>
        <h3 className="v3-ins-sub">Shrinking</h3>
        {list(sum.movers.down, 'down')}
      </div>
      <p className="v3-ins-foot">
        Against {shortDate(sum.prevFrom)} – {shortDate(sum.prevTo!)}, the same length of time just before.
      </p>
    </div>
  )
}

export function ForeignNote({ sum }: { sum: Summary }) {
  return sum.foreign.length ? (
    <p className="v3-panel-note" style={{ marginTop: 'var(--space-4)' }}>
      Plus {sum.foreign.map(f => `${money(f.total, f.currency)} (${f.count})`).join(' and ')} in foreign currency, kept out of
      the ringgit totals.
    </p>
  ) : null
}
