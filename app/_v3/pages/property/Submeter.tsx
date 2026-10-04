import type { PropertyRead } from '@/lib/property'
import type { SubmeterRead } from '@/lib/submeter'
import { FLAT_RATE, HEALTHY_BUFFER, HIGH_USE_KWH, LONG_GAP_DAYS, buffers, cycles, daysBetween, leakSummary, nextReadingDue, segments, unitsOf, type Bill, type Reading } from '@/lib/submeter-math'
import { BillForm, DeleteRow, ReadingForm } from '../../SubmeterForms'
import TenancySetup from './TenancySetup'
import { dmy, plural, rm, sen, today as now } from './shared'

// 👉 v3 Property → Sub-meter: a dual-key property's two split meters against the TNB bill. Per property:
// the flat rate, TNB's real cost per kWh, the leak check (both sub-meters against TNB's kWh) and the
// buffer — what was charged less what the electricity cost. Old rates stay as history; the flat rate
// (RM 0.50 for every unit) applies from the readings after it was set.

const pct = (f: number | null | undefined, digits = 1) => (f == null ? '—' : `${f > 0 ? '+' : f < 0 ? '−' : ''}${Math.abs(f * 100).toFixed(digits)}%`)
const kwh = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-MY', { maximumFractionDigits: 1 }))
const per = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(3))

export default function Submeter({ read, sub, sqlUrl, submeterSql }: { read: PropertyRead; sub: SubmeterRead; sqlUrl: string | null; submeterSql: string }) {
  if (!read.ready) return <p className="v3-empty">Set up Property first — open Loans.</p>
  const today = now()
  // Properties that already have sub-meter rows; before any exist, every property gets a section so the first reading can be typed.
  const used = sub.ready ? new Set([...sub.readings.map(r => r.property_id), ...sub.bills.map(b => b.property_id)]) : new Set<string>()
  const shown = read.loans.filter(l => used.size === 0 || used.has(l.loan.id))
  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Sub-meter</h1>
          <p className="v3-lede">
            {sub.ready
              ? `Split meters for a dual-key unit, checked against the TNB bill. One flat rate of RM ${sen(FLAT_RATE)} per kWh for every unit.${read.demo ? ' Demo data.' : ''}`
              : 'Electricity for a dual-key unit, billed from its split meters.'}
          </p>
        </div>
        {shown.length > 1 ? (
          <nav className="v3-prop-jump" aria-label="Properties">
            {shown.map(l => (
              <a key={l.loan.id} className="v3-chip" href={`#${l.loan.id}`}>
                {l.loan.name}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
      {!sub.ready ? (
        <TenancySetup sql={submeterSql} sqlUrl={sqlUrl} />
      ) : (
        shown.map(l => (
          <PropertySubmeter key={l.loan.id} id={l.loan.id} name={l.loan.name} location={l.loan.location} readings={sub.readings.filter(r => r.property_id === l.loan.id)} bills={sub.bills.filter(b => b.property_id === l.loan.id)} today={today} />
        ))
      )}
    </div>
  )
}

function PropertySubmeter({ id, name, location, readings, bills, today }: { id: string; name: string; location: string | null; readings: Reading[]; bills: Bill[]; today: string }) {
  const cs = cycles(bills, readings)
  const segs = segments(readings, cs)
  const buf = buffers(segs)
  const leak = leakSummary(cs)
  const units = unitsOf(readings)
  const byId = new Map(readings.map(r => [r.id, r]))
  const last = readings.reduce<string | null>((m, r) => (m == null || r.read_on > m ? r.read_on : m), null)
  const age = last ? daysBetween(last, today) : null
  const flat = buf.flat
  const overWorst = leak.worstCost ? FLAT_RATE / leak.worstCost - 1 : null
  return (
    <section className="v3-prop" id={id} aria-labelledby={`s-${id}`}>
      <div className="v3-prop-head">
        <div>
          <h2 className="v3-chapter-title" id={`s-${id}`}>
            {name}
          </h2>
          <p className="v3-panel-note">{[location, units.length ? units.join(' + ') : null].filter(Boolean).join(' · ')}</p>
        </div>
        {last ? (
          <p className="v3-panel-note">
            Last read {dmy(last)} ({plural(age ?? 0, 'day')} ago) · next due {dmy(nextReadingDue(today))}{' '}
            {age != null && age > LONG_GAP_DAYS ? (
              <span className="v3-tag" data-q="estimated">
                Overdue
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="v3-kpis">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Flat rate</div>
          <div className="v3-kpi-value">RM {sen(FLAT_RATE)}</div>
          <div className="v3-kpi-note">per kWh, every unit</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">TNB cost per kWh</div>
          <div className="v3-kpi-value">{leak.latestCost != null ? `RM ${per(leak.latestCost)}` : '—'}</div>
          <div className="v3-kpi-note">{leak.avgCost != null ? `latest bill · average ${per(leak.avgCost)} · worst ${per(leak.worstCost)}${overWorst != null ? ` · flat rate ${pct(overWorst, 0)} over the worst` : ''}` : 'add TNB bills to see it'}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Buffer on the flat rate</div>
          <div className="v3-kpi-value">{flat.n ? rm(flat.buffer) : '—'}</div>
          <div className="v3-kpi-note">
            {flat.n ? (
              <>
                {pct(flat.pct)} over cost · {flat.pct != null && flat.pct >= HEALTHY_BUFFER ? 'healthy' : 'thin'}
              </>
            ) : (
              'no reading on the flat rate yet'
            )}
          </div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Leak check</div>
          <div className="v3-kpi-value">{pct(leak.gap)}</div>
          <div className="v3-kpi-note">{leak.n ? `sub-meters vs TNB kWh, ${plural(leak.n, 'bill')}` : 'needs readings either side of a bill'}</div>
        </div>
      </div>

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-8" aria-label={`${name} against each TNB bill`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Against each TNB bill</h3>
          </div>
          <p className="v3-panel-note" style={{ marginTop: 0 }}>
            Readings are laid on a straight line, so each unit&rsquo;s usage is worked out to the 12th even when you read on another day. Gap near zero means nothing leaks. Months over {HIGH_USE_KWH} kWh add TNB&rsquo;s retail charge and service tax. When a bill has no kWh typed, the two sub-meters stand in for it.
          </p>
          {cs.length === 0 ? (
            <p className="v3-empty">No TNB bills yet.</p>
          ) : (
            <div className="v3-table-wrap">
              <table className="v3-table v3-prop-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th className="r">TNB kWh</th>
                    {units.map(u => (
                      <th key={u} className="r">
                        {u}
                      </th>
                    ))}
                    <th className="r">Gap</th>
                    <th className="r">TNB RM</th>
                    <th className="r">RM/kWh</th>
                    <th>
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...cs].reverse().map(c => (
                    <tr key={c.bill.id}>
                      <td>
                        {dmy(c.bill.bill_date)}{' '}
                        {c.high ? (
                          <span className="v3-tag" data-q="estimated">
                            over {HIGH_USE_KWH}
                          </span>
                        ) : null}
                      </td>
                      <td className="r num">{kwh(c.tnbKwh)}</td>
                      {c.units.map(u => (
                        <td key={u.unit} className="r num">
                          {kwh(u.kwh)}
                        </td>
                      ))}
                      <td className="r num">{pct(c.gap)}</td>
                      <td className="r num">{sen(c.bill.amount)}</td>
                      <td className="r num">{per(c.perKwh)}</td>
                      <td>
                        <DeleteRow id={c.bill.id} kind="bill" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="v3-panel v3-span-4" aria-label={`Add a TNB bill for ${name}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Add the TNB bill</h3>
          </div>
          <BillForm propertyId={id} />
        </section>
      </div>

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-8" aria-label={`${name} meter readings`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Meter readings</h3>
          </div>
          <p className="v3-panel-note" style={{ marginTop: 0 }}>
            Charged is the usage times the rate set when you read. TNB cost is the real cost per kWh over the same days, so the buffer is what the rate earned above it. Old rates stay as history.
          </p>
          {segs.length === 0 ? (
            <p className="v3-empty">Two readings of the same meter are needed to see usage. Type today&rsquo;s reading.</p>
          ) : (
            <div className="v3-table-wrap">
              <table className="v3-table v3-prop-table">
                <thead>
                  <tr>
                    <th>Read on</th>
                    <th>Unit</th>
                    <th className="r">Meter</th>
                    <th className="r">Used kWh</th>
                    <th className="r">Days</th>
                    <th className="r">kWh/day</th>
                    <th className="r">Rate</th>
                    <th className="r">Charged</th>
                    <th className="r">TNB cost</th>
                    <th className="r">Buffer</th>
                    <th>
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segs.map(s => (
                    <tr key={s.id}>
                      <td>
                        {dmy(s.to)}{' '}
                        {s.legacy ? (
                          <span className="v3-tag" data-q="unchecked">
                            old rate
                          </span>
                        ) : null}
                        {s.flags.map(f => (
                          <div key={f} className="v3-panel-note" style={{ color: 'var(--mark)' }}>
                            {f}
                          </div>
                        ))}
                        {byId.get(s.id)?.note ? <div className="v3-panel-note">{byId.get(s.id)?.note}</div> : null}
                      </td>
                      <td>{s.unit}</td>
                      <td className="r num">{kwh(byId.get(s.id)?.reading)}</td>
                      <td className="r num">{kwh(s.kwh)}</td>
                      <td className="r num">{s.days}</td>
                      <td className="r num">{s.perDay.toFixed(1)}</td>
                      <td className="r num">{s.rate != null ? sen(s.rate) : '—'}</td>
                      <td className="r num">{s.charged != null ? sen(s.charged) : '—'}</td>
                      <td className="r num">{s.cost != null ? sen(s.cost) : '—'}</td>
                      <td className="r num">{s.buffer != null ? rm(s.buffer) : '—'}</td>
                      <td>
                        <DeleteRow id={s.id} kind="reading" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {buf.old.n || flat.n ? (
            <ul className="v3-prop-more" style={{ listStyle: 'none', padding: 0 }}>
              {flat.n ? (
                <li>
                  <b>On the flat rate:</b> charged {rm(flat.charged)}, cost {rm(flat.cost)}, buffer {rm(flat.buffer)} ({pct(flat.pct)}).
                </li>
              ) : null}
              {buf.old.n ? (
                <li>
                  <b>On the old rates ({plural(buf.old.n, 'reading')} with bills to compare):</b> charged {rm(buf.old.charged)}, cost {rm(buf.old.cost)}, buffer {rm(buf.old.buffer)} ({pct(buf.old.pct)}). Costs before Apr 2026 are estimated from the bill amounts.
                </li>
              ) : null}
            </ul>
          ) : null}
        </section>
        <section className="v3-panel v3-span-4" aria-label={`Add readings for ${name}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Add readings</h3>
          </div>
          <p className="v3-panel-note" style={{ marginTop: 0 }}>
            Read both meters on the 12th, the day TNB bills, and take a photo.
          </p>
          <ReadingForm propertyId={id} units={units.length ? units : ['Main unit', 'Studio']} rate={FLAT_RATE} />
        </section>
      </div>
    </section>
  )
}
