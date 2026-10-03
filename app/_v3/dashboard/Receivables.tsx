import { ageing, OWED_WINDOW_DAYS, type OwedLine } from '@/lib/v3/studio'
import { money, rmFull } from '../fmt'

// Question 3, as a figure: who owes me money, at a glance. The working list —
// sort, mark paid, confirm older invoices — lives on Invoice Details; this card
// only states the position and points there.
//
// Ringgit only in the total and the ageing bar. Foreign-currency invoices are
// counted beside it, never converted. Nothing is called overdue: there are no
// due dates in the records, only days since issue.

export default function Receivables({
  owed,
  owedTotal,
  recentPaid,
  untracked,
  olderCount,
  filtered,
}: {
  owed: OwedLine[]
  owedTotal: number
  recentPaid: number // RM marked paid, same window and filters as `owed`
  untracked: number
  olderCount: number
  filtered: boolean // a client/kind filter is on — Invoice Details lists every invoice
}) {
  const buckets = ageing(owed)
  const rmCount = owed.filter(o => o.currency === 'MYR').length
  const foreign = owed.filter(o => o.currency !== 'MYR')
  const oldest = owed[0]?.days ?? null // owed is sorted longest waiting first
  // Of the tracked invoices raised in the window, the share already paid.
  const tracked = recentPaid + owedTotal
  const collected = tracked ? recentPaid / tracked : null
  const top = owed.slice(0, 3)

  return (
    <div className="v3-recv">
      <div className="v3-recv-figure">
        <div className="v3-kpi-value num">{rmFull(owedTotal)}</div>
        <div className="v3-kpi-note">
          {rmCount
            ? `${rmCount} invoice${rmCount === 1 ? '' : 's'} · oldest ${oldest} day${oldest === 1 ? '' : 's'}`
            : `Nothing tracked as unpaid in the last ${OWED_WINDOW_DAYS} days`}
          {foreign.length ? ` · plus ${foreign.map(f => money(f.amount, f.currency)).join(', ')}` : ''}
        </div>
      </div>

      {owedTotal > 0 ? (
        <div className="v3-age" aria-label="Owed ringgit by days since issue">
          <div className="v3-age-bar" aria-hidden="true">
            {buckets.map(b =>
              b.total ? <i key={b.id} data-age={b.id} style={{ flexGrow: b.total }} title={`${b.label}: ${rmFull(b.total)}`} /> : null,
            )}
          </div>
          <dl className="v3-age-legend">
            {buckets.map(b => (
              <div key={b.id} data-empty={b.count ? undefined : 'true'}>
                <dt>
                  <span className="v3-age-dot" data-age={b.id} aria-hidden="true" />
                  {b.label}
                </dt>
                <dd className="num">{b.count ? rmFull(b.total) : '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {collected !== null ? (
        <div className="v3-recv-meter">
          <div className="v3-recv-meter-head">
            <span>Collected</span>
            <b className="num">{Math.round(collected * 100)}%</b>
          </div>
          <span className="v3-owed-track" aria-hidden="true">
            <i style={{ ['--w' as string]: collected.toFixed(3) }} />
          </span>
          <p className="v3-kpi-note">
            {rmFull(recentPaid)} of {rmFull(tracked)} tracked, last {OWED_WINDOW_DAYS} days
          </p>
        </div>
      ) : null}

      {top.length ? (
        <div className="v3-rows v3-recv-top">
          {top.map(l => (
            <div className="v3-row" key={l.id}>
              <div className="v3-row-main">
                <div className="v3-row-title">{l.client}</div>
                <div className="v3-row-sub">
                  <span className="code">{l.no}</span> · {l.days} days
                </div>
              </div>
              <div className="v3-row-num">{money(l.amount, l.currency)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <a className="v3-recv-cta" href="/invoices/details#owed">
        {filtered
          ? 'All owed invoices, unfiltered, in Invoice Details'
          : owed.length > top.length
            ? `See all ${owed.length} and mark paid`
            : 'Mark paid in Invoice Details'}
        {untracked || olderCount
          ? ` · ${[olderCount ? `${olderCount} older` : '', untracked ? `${untracked} not tracked` : ''].filter(Boolean).join(', ')}`
          : ''}
        <span aria-hidden="true"> →</span>
      </a>
    </div>
  )
}
