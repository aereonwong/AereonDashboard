import { RISK_LINE, type PaySpeed, type ClientRisk, type Seasons, type ReachVsWork } from '@/lib/v3/insights'
import { rmFull, compact, shortDate } from '../fmt'

// 👉 The Dashboard's insight panels (lib/v3/insights.ts does the counting).
// Each one states a finding in a sentence first, then shows what it rests on.

const days = (n: number) => `${Math.round(n)} day${Math.round(n) === 1 ? '' : 's'}`
const share = (x: number) => `${Math.round(x * 100)}%`

// ------------------------------------------------------------- Getting paid

export function GettingPaid({ p }: { p: PaySpeed }) {
  const left = [
    p.paidUndated ? `${p.paidUndated} paid with no payment date yet` : '',
    p.paidNoDate ? `${p.paidNoDate} with no delivery date` : '',
    p.paidEarly ? `${p.paidEarly} paid before delivery` : '',
  ].filter(Boolean)
  return (
    <div className="v3-ins">
      <div className="v3-ins-pair">
        <div>
          <div className="v3-kpi-label">Delivered → paid</div>
          <div className="v3-kpi-value num">{p.medianDays !== null ? days(p.medianDays) : '—'}</div>
          <div className="v3-kpi-note">
            {p.paid.length
              ? `median of ${p.paid.length} paid invoice${p.paid.length === 1 ? '' : 's'}`
              : 'Starts counting as payment dates are recorded'}
          </div>
        </div>
        <div>
          <div className="v3-kpi-label">Delivered → invoiced</div>
          <div className="v3-kpi-value num">{p.lagMedian !== null ? days(p.lagMedian) : '—'}</div>
          <div className="v3-kpi-note">
            {p.lagCount
              ? `median of ${p.lagCount} invoices raised after delivery${p.lagAhead ? ` · ${p.lagAhead} raised on or before it` : ''}`
              : 'No invoices with a delivery date yet'}
          </div>
        </div>
      </div>

      {p.slowest.length ? (
        <div>
          <h3 className="v3-ins-sub">Slowest to pay</h3>
          <div className="v3-rows">
            {p.slowest.map(c => (
              <div className="v3-row" key={c.client}>
                <div className="v3-row-main">
                  <div className="v3-row-title">{c.client}</div>
                  <div className="v3-row-sub">
                    {c.count} paid invoice{c.count === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="v3-row-num">{days(c.median)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {p.lagLate.length ? (
        <div>
          <h3 className="v3-ins-sub">Invoiced longest after delivery</h3>
          <div className="v3-rows">
            {p.lagLate.map(l => (
              <div className="v3-row" key={l.id}>
                <div className="v3-row-main">
                  <div className="v3-row-title">{l.client}</div>
                  <div className="v3-row-sub">
                    <span className="code">{l.no}</span> · delivered {shortDate(l.delivered)}
                  </div>
                </div>
                <div className="v3-row-num">{days(l.days)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="v3-ins-foot">
        Delivered = the tagged Instagram post, or the event date when no post is tagged. Paid = the payment date recorded on
        the invoice, not the day it was ticked.
        {left.length ? ` Left out: ${left.join(', ')}.` : ''}
      </p>
    </div>
  )
}

// --------------------------------------------------------------- Client risk

export function ClientRiskCard({ r }: { r: ClientRisk }) {
  if (!r.total) return <p className="v3-empty">No ringgit invoices in the last 12 months.</p>
  const lead = r.top[0]
  const risky = r.top1Share > RISK_LINE
  const topHeavy = !risky && r.top3Share > 0.6
  const rest = Math.max(0, 1 - r.top.reduce((s, c) => s + c.share, 0))
  // From the rounded shares, so the difference matches the percentages shown.
  const delta = r.prevTop1Share !== null ? Math.round(r.top1Share * 100) - Math.round(r.prevTop1Share * 100) : null
  const sameLeader = r.prevTop1Client === lead.client
  return (
    <div className="v3-ins">
      <div className="v3-ins-lead">
        <div className="v3-kpi-value num">
          {share(r.top1Share)}
          <span className={`v3-ins-flag${risky || topHeavy ? ' risk' : ''}`}>
            {risky ? `Above ${share(RISK_LINE)}` : topHeavy ? 'Top three heavy' : 'Spread well'}
          </span>
        </div>
        <div className="v3-kpi-note">
          of ringgit invoiced in the last 12 months went to {lead.client}
          {r.prevTop1Share !== null
            ? sameLeader
              ? delta
                ? ` · ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} points on the year before`
                : ' · same share as the year before'
              : ` · the year before, the biggest was ${r.prevTop1Client} at ${share(r.prevTop1Share)}`
            : ''}
        </div>
      </div>

      <div>
        <div className="v3-risk-bar" aria-hidden="true">
          {r.top.map((c, i) => (
            <i key={c.client} data-rank={i + 1} style={{ flexGrow: c.share }} title={`${c.client}: ${share(c.share)}`} />
          ))}
          <i data-rank="rest" style={{ flexGrow: rest }} />
          <b className="v3-risk-line" style={{ left: `${RISK_LINE * 100}%` }} />
        </div>
        <p className="v3-ins-scale">
          <span>0</span>
          <span style={{ left: `${RISK_LINE * 100}%` }}>{share(RISK_LINE)} line</span>
          <span>100%</span>
        </p>
      </div>

      <div className="v3-rows">
        {r.top.map((c, i) => (
          <div className="v3-row" key={c.client}>
            <div className="v3-row-main">
              <div className="v3-row-title">
                <span className="v3-risk-dot" data-rank={i + 1} aria-hidden="true" />
                {c.client}
              </div>
            </div>
            <div className="v3-row-num">
              {share(c.share)} <span className="v3-ins-dim">· {rmFull(c.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="v3-ins-foot">
        Top three make {share(r.top3Share)} of {rmFull(r.total)}. {r.forEighty} of {r.clients} clients make 80% of it. Last 12
        months to today; a client filter doesn&apos;t apply here.
      </p>
    </div>
  )
}

// ------------------------------------------------------ Busy and quiet months

export function SeasonsGrid({ s }: { s: Seasons }) {
  const busy = s.average.filter(a => a.tone === 'busy').map(a => a.label)
  const quiet = s.average.filter(a => a.tone === 'quiet').map(a => a.label)
  const avgPeak = Math.max(1, ...s.average.map(a => a.average))
  return (
    <div className="v3-ins">
      {s.fullYears.length ? (
        <p className="v3-ins-say">
          {busy.length ? (
            <>
              Busiest: <b>{busy.join(', ')}</b>.{' '}
            </>
          ) : null}
          {quiet.length ? (
            <>
              Quietest: <b>{quiet.join(', ')}</b> — worth filling ahead of time.
            </>
          ) : null}
          {!busy.length && !quiet.length ? 'Work is spread evenly across the year.' : null}
        </p>
      ) : null}
      <div className="v3-season" role="table" aria-label="Invoiced each month, by year">
        <div className="v3-season-row v3-season-head" role="row">
          <span role="columnheader" />
          {s.average.map(a => (
            <span key={a.month} role="columnheader">
              {a.label}
            </span>
          ))}
          <span role="columnheader" className="r">
            Year
          </span>
        </div>
        {s.rows.map(row => (
          <div className="v3-season-row" role="row" key={row.year}>
            <span role="rowheader" className="v3-season-year">
              {row.year}
            </span>
            {row.cells.map(c => (
              <span
                role="cell"
                key={c.month}
                className="v3-season-cell"
                data-future={c.future ? 'true' : undefined}
                data-strong={c.total / s.peak >= 0.55 ? 'true' : undefined}
                style={{ ['--a' as string]: (c.total / s.peak).toFixed(3) }}
                title={`${row.year} ${s.average[c.month - 1].label}: ${rmFull(c.total)}, ${c.count} invoice${c.count === 1 ? '' : 's'}`}
              >
                {c.future ? '' : c.total ? compact(c.total) : '·'}
              </span>
            ))}
            <span role="cell" className="v3-season-total num">
              {compact(row.total)}
            </span>
          </div>
        ))}
        {s.fullYears.length ? (
          <div className="v3-season-row v3-season-avg" role="row">
            <span role="rowheader" className="v3-season-year">
              Typical
            </span>
            {s.average.map(a => (
              <span role="cell" key={a.month} className="v3-season-avgcell" data-tone={a.tone} title={`${a.label}: ${rmFull(a.average)} a year on average`}>
                <i style={{ ['--h' as string]: (a.average / avgPeak).toFixed(3) }} />
              </span>
            ))}
            <span role="cell" />
          </div>
        ) : null}
      </div>
      <p className="v3-ins-foot">
        Ringgit invoiced, one shared scale for every cell.
        {s.fullYears.length
          ? ` Typical = the average month over ${s.fullYears[0]}–${s.fullYears.at(-1)} (${s.fullYears.length} full years); busy is 40% above the average month, quiet 40% below.`
          : ''}
      </p>
    </div>
  )
}

// --------------------------------------------------- Reach and paid work

export function ReachAndWork({ v, client }: { v: ReachVsWork; client?: string }) {
  if (v.months.length < 2)
    return <p className="v3-empty">Not enough Instagram history yet — this fills in as snapshots build up.</p>
  const reachPeak = Math.max(1, ...v.months.map(m => m.reach))
  const rmPeak = Math.max(1, ...v.months.map(m => m.invoiced))
  const lift = v.highNext !== null && v.lowNext ? (v.highNext - v.lowNext) / v.lowNext : null
  return (
    <div className="v3-ins">
      <p className="v3-ins-say">
        {lift !== null ? (
          <>
            In the two months after high-reach months, invoicing averaged <b>{rmFull(v.highNext!)}</b>, against{' '}
            <b>{rmFull(v.lowNext!)}</b> after quieter ones ({lift >= 0 ? '+' : ''}
            {Math.round(lift * 100)}%), across {v.scored} months. A pattern, not proof that reach causes the work.
          </>
        ) : (
          <>
            {v.months.length} months of Instagram history so far. Comparing invoicing after high- and low-reach months
            needs about six months that each have two full months after them.
          </>
        )}
      </p>
      <div className="v3-rvw" role="table" aria-label="Reach and invoiced ringgit by month">
        {v.months.map(m => (
          <div className="v3-rvw-col" role="row" key={m.key}>
            <div className="v3-rvw-bars" aria-hidden="true">
              <i className="reach" style={{ ['--h' as string]: (m.reach / reachPeak).toFixed(3) }} />
              <i className="rm" style={{ ['--h' as string]: (m.invoiced / rmPeak).toFixed(3) }} />
            </div>
            <span role="rowheader" className="v3-rvw-label">
              {m.label}
            </span>
            <span role="cell" className="v3-rvw-num">
              {m.posts ? compact(m.reach) : '0 posts'}
            </span>
            <span role="cell" className="v3-rvw-num rm">
              {m.invoiced ? compact(m.invoiced) : '—'}
            </span>
          </div>
        ))}
      </div>
      <p className="v3-ins-foot">
        <span className="v3-rvw-key reach" /> Reach of that month&apos;s posts, added up post by post (one person can count
        more than once){' '}
        <span className="v3-rvw-key rm" /> RM invoiced that month{client ? ' (all clients — a client filter doesn’t apply here)' : ''}.
        Each on its own scale; recent months are still gathering reach. The oldest month is left out because
        the stored posts start partway through it.
        {v.linked.count
          ? ` ${v.linked.count} invoice${v.linked.count === 1 ? ' is' : 's are'} tagged to a post (${rmFull(v.linked.total)}).`
          : ''}
      </p>
    </div>
  )
}
