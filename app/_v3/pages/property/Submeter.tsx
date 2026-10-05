import type { PropertyRead } from '@/lib/property'
import type { SubmeterRead } from '@/lib/submeter'
import { FLAT_RATE, HIGH_USE_KWH, LONG_GAP_DAYS, billing, cycles, daysBetween, leakSummary, nextReadingDue, segments, tnbVsTenants, unitState, unitsOf, usageShare, type Bill, type Reading, type Segment, type TenantBilling } from '@/lib/submeter-math'
import { groupTenants } from '@/lib/tenancy-math'
import { BillForm, DeleteRow, PaidCell, ReadingForm, TenantTag } from '../../SubmeterForms'
import SubmeterChart, { type ChartCycle } from '../../SubmeterChart'
import TenancySetup from './TenancySetup'
import { dmy, plural, rm, sen, today as now } from './shared'

// 👉 v3 Property → Sub-meter: electricity for a dual-key property, read from each unit's split meter and
// billed to the tenant living there. It is collected from the tenants, so it is never a property cost;
// what the rate earns above TNB's real cost is shown apart, at the foot, and worked out separately.
// Analytics: each unit's usage against every TNB bill (chart), each tenant's bill, the usage share,
// TNB's cost per kWh and the leak check (both sub-meters against TNB's kWh).

const pct = (f: number | null | undefined, digits = 1) => (f == null ? '—' : `${f > 0 ? '+' : f < 0 ? '−' : ''}${Math.abs(f * 100).toFixed(digits)}%`)
const kwh = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-MY', { maximumFractionDigits: 1 }))
const per = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(3))
const share = (f: number) => `${Math.round(f * 100)}%`
const who = (t: string | null) => t ?? 'Not tagged'

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
              ? `Electricity read from each unit's meter and billed to its tenant at RM ${sen(FLAT_RATE)} per kWh. Collected from the tenants, so it is not a property cost.${read.demo ? ' Demo data.' : ''}`
              : 'Electricity for a dual-key unit, billed to each tenant from its split meter.'}
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
        <>
          {!sub.tenantReady || !sub.paidReady || !sub.kindReady ? <TenancySetup sql={submeterSql.slice(submeterSql.indexOf('-- Who each unit'), submeterSql.indexOf('-- Server-side only')).trim()} sqlUrl={sqlUrl} /> : null}
          {shown.map(l => (
            <PropertySubmeter
              key={l.loan.id}
              id={l.loan.id}
              name={l.loan.name}
              location={l.loan.location}
              readings={sub.readings.filter(r => r.property_id === l.loan.id)}
              bills={sub.bills.filter(b => b.property_id === l.loan.id)}
              tenantNames={groupTenants(l.tenancies, today).map(g => g.name).filter((n): n is string => !!n)}
              tagging={sub.tenantReady}
              paying={sub.paidReady}
              kinds={sub.kindReady}
              today={today}
            />
          ))}
        </>
      )}
    </div>
  )
}

function PropertySubmeter({ id, name, location, readings, bills, tenantNames, tagging, paying, kinds, today }: { id: string; name: string; location: string | null; readings: Reading[]; bills: Bill[]; tenantNames: string[]; tagging: boolean; paying: boolean; kinds: boolean; today: string }) {
  const cs = cycles(bills, readings)
  const segs = segments(readings, cs)
  const pnl = tnbVsTenants(cs, segs)
  const leak = leakSummary(cs)
  const units = unitsOf(readings)
  const people = billing(segs, today)
  const shares = usageShare(segs, today)
  const byId = new Map(readings.map(r => [r.id, r]))
  const tenants = [...new Set([...tenantNames, ...readings.map(r => r.tenant_name).filter((t): t is string => !!t)])]
  const last = readings.reduce<string | null>((m, r) => (m == null || r.read_on > m ? r.read_on : m), null)
  const age = last ? daysBetween(last, today) : null
  const billed12 = people.reduce((t, p) => t + p.billed12, 0)
  const owed = people.reduce((t, p) => t + p.owed, 0)
  // How many unpaid charges sit before each one for the same tenant and unit: offered as "mark these too" in the popup.
  const earlierUnpaid = (s: Segment) => segs.filter(o => o.unit === s.unit && o.tenant === s.tenant && o.to < s.to && !o.paidOn && o.charged != null && o.charged > 0).length
  const perDay = shares.reduce((t, u) => t + u.perDay, 0)
  const overWorst = leak.worstCost ? FLAT_RATE / leak.worstCost - 1 : null
  // Who each unit is billed to now: the tenant on its latest reading; the form starts there.
  const state = unitState(readings)
  const currentTenant = (unit: string) => (state.get(unit)?.kind === 'move_in' ? (state.get(unit)?.tenant ?? null) : (people.find(p => p.unit === unit && p.current)?.tenant ?? null))
  // A tenant who has moved in but not been read since: no bill yet, only their starting number.
  const arrivals = [...state.entries()].filter(([, st]) => st.kind === 'move_in').map(([unit, st]) => ({ unit, ...st }))
  const between = segs.filter(x => x.vacant)
  // Who was billed for a unit on a date: the segment around it.
  const tenantOn = (unit: string, date: string) => segs.find(s => s.unit === unit && s.from < date && date <= s.to)?.tenant ?? null
  const chart: ChartCycle[] = cs.slice(-12).map(c => ({
    date: c.bill.bill_date,
    tnbKwh: c.tnbKwh,
    amount: c.bill.amount,
    perKwh: c.perKwh,
    perKwhEstimated: c.perKwhFrom === 'submeters',
    gap: c.gap,
    units: c.units.map(u => ({ ...u, tenant: tenantOn(u.unit, c.bill.bill_date) })),
  }))

  return (
    <section className="v3-prop" id={id} aria-labelledby={`s-${id}`}>
      <div className="v3-prop-head">
        <div>
          <h2 className="v3-chapter-title" id={`s-${id}`}>
            {name}
          </h2>
          <p className="v3-panel-note">{location ?? (units.length ? units.join(' + ') : null)}</p>
        </div>
        {last ? (
          <p className="v3-panel-note">
            Last read {dmy(last)} ({plural(age ?? 0, 'day')} ago) · next due {dmy(nextReadingDue(today))}{' '}
            {age != null && age > LONG_GAP_DAYS ? (
              <span className="v3-tag" data-q="estimated">
                Reading overdue
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="v3-kpis">
        <div className="v3-kpi">
          {paying ? (
            <>
              <div className="v3-kpi-label">Still to collect</div>
              <div className="v3-kpi-value">{people.length ? rm(owed) : '—'}</div>
              <div className="v3-kpi-note">
                {people.filter(p => p.owed > 0).map(p => `${who(p.tenant)} ${rm(p.owed)}`).join(' · ') || 'every charge is paid'} · billed {rm(billed12)} in 12 months
              </div>
            </>
          ) : (
            <>
              <div className="v3-kpi-label">Billed to tenants · 12 months</div>
              <div className="v3-kpi-value">{people.length ? rm(billed12) : '—'}</div>
              <div className="v3-kpi-note">{people.filter(p => p.billed12 > 0).map(p => `${who(p.tenant)} ${rm(p.billed12)}`).join(' · ') || 'nothing read in the last year'}</div>
            </>
          )}
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Electricity used</div>
          <div className="v3-kpi-value">{perDay ? `${perDay.toFixed(1)} kWh/day` : '—'}</div>
          <div className="v3-kpi-note">{shares.length ? shares.map(u => `${u.unit} ${share(u.share)}`).join(' · ') : 'two readings of a meter needed'}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">TNB cost per kWh</div>
          <div className="v3-kpi-value">{leak.latestCost != null ? `RM ${per(leak.latestCost)}` : '—'}</div>
          <div className="v3-kpi-note">
            {leak.avgCost != null ? `latest bill · worst ${per(leak.worstCost)}${overWorst != null ? ` · your RM ${sen(FLAT_RATE)} is ${pct(overWorst, 0)} above it` : ''}` : 'add TNB bills to see it'}
          </div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Meters vs TNB</div>
          <div className="v3-kpi-value">{pct(leak.gap)}</div>
          <div className="v3-kpi-note">{leak.n ? `both meters against TNB over ${plural(leak.n, 'bill')} · near 0 = no leak` : 'needs readings either side of a bill'}</div>
        </div>
      </div>

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-8" aria-label={`${name} usage against each TNB bill`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Usage against each TNB bill</h3>
          </div>
          <SubmeterChart cycles={chart} high={HIGH_USE_KWH} />
          <p className="v3-panel-note v3-sub-chartnote">Readings rarely fall on the 12th, so each unit&rsquo;s share of a bill is worked out along a straight line between its readings. A single month can swing; the gap over many bills is the leak check.</p>
        </section>
        <section className="v3-panel v3-span-4" aria-label={`Record readings for ${name}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Record the meters</h3>
          </div>
          <p className="v3-panel-note" style={{ marginTop: 0 }}>
            Read both on the 12th, the day TNB bills, and take a photo.
          </p>
          <ReadingForm propertyId={id} units={(units.length ? units : ['Main unit', 'Studio']).map(unit => ({ unit, tenant: currentTenant(unit), empty: state.get(unit)?.kind === 'move_out' }))} tenants={tenants} rate={FLAT_RATE} tagging={tagging} kinds={kinds} />
          <details className="v3-sub-billform">
            <summary>Add the TNB bill</summary>
            <BillForm propertyId={id} />
          </details>
        </section>
      </div>

      {people.length || arrivals.length ? (
        <div className="v3-prop-cards" aria-label="Who to bill">
          {arrivals.map(a => (
            <section key={`in-${a.unit}`} className="v3-panel v3-prop-card v3-sub-card" aria-label={`${who(a.tenant)} moved in`}>
              <div className="v3-prop-tenant-head">
                <div>
                  <h3 className="v3-chapter-title">{who(a.tenant)}</h3>
                  <p className="v3-panel-note" style={{ margin: 0 }}>
                    {a.unit} · moved in {dmy(a.date)}
                  </p>
                </div>
                <span className="v3-tag v3-sub-kind">Moved in</span>
              </div>
              <div>
                <div className="v3-kpi-label">Starting reading</div>
                <div className="v3-kpi-value">{kwh(a.reading)}</div>
                <div className="v3-kpi-note">Their first bill comes with the next reading, counted from this number.</div>
              </div>
            </section>
          ))}
          {people.map(p => (
            <TenantCard key={`${p.unit}-${p.tenant}`} p={p} share={shares.find(u => u.unit === p.unit)?.share ?? null} paying={paying} />
          ))}
        </div>
      ) : null}

      <section className="v3-panel" aria-label={`${name} charges per reading`}>
        <div className="v3-panel-head">
          <h3 className="v3-panel-title">Charges per reading</h3>
        </div>
        <p className="v3-panel-note" style={{ marginTop: 0 }}>
          What each tenant owes for the usage since their unit&rsquo;s previous reading, at the rate set when it was read.
          {tagging ? ' Billed to the wrong tenant? Change it in the row and it moves to the right table.' : ''}
          {paying ? ' Mark a charge paid with the date the money came in — it can be recorded later.' : ''}
        </p>
        {segs.length === 0 ? (
          <p className="v3-empty">Two readings of the same meter are needed to see usage. Record today&rsquo;s readings.</p>
        ) : (
          people.map(p => (
            <div key={`${p.unit}-${p.tenant}`} className="v3-sub-group">
              <div className="v3-sub-group-head">
                <h4>
                  {who(p.tenant)} <span className="v3-sub-sub">{p.unit}{p.movedOut ? ` · moved out ${dmy(p.movedOut.date)}` : p.current ? '' : ' · earlier tenant'}</span>
                </h4>
                <span className="v3-panel-note">
                  {plural(p.segments.length, 'reading')} · billed {rm(p.billed)}
                  {paying ? (p.owed > 0 ? <b className="v3-sub-group-owed"> · {rm(p.owed)} to collect</b> : <span className="v3-sub-group-paid"> · all paid</span>) : null}
                </span>
              </div>
              <div className="v3-table-wrap">
                <table className="v3-table v3-prop-table v3-sub-table">
                  <thead>
                    <tr>
                      <th>Read on</th>
                      <th className="r">Charge</th>
                      {paying ? <th>Paid</th> : null}
                      {tagging ? <th>Billed to</th> : null}
                      <th className="r">Meter</th>
                      <th className="r">Used</th>
                      <th className="r">kWh/day</th>
                      <th className="r">Rate</th>
                      <th>
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.segments.map(s => (
                      <ChargeRow key={s.id} s={s} reading={byId.get(s.id)} tenants={tenants} tagging={tagging} paying={paying} earlier={earlierUnpaid(s)} />
                    ))}
                    <tr className="v3-sub-startrow">
                      <td colSpan={2 + (paying ? 1 : 0) + (tagging ? 1 : 0)}>
                        {dmy(p.start.date)} <span className="v3-tag v3-sub-kind">Starting reading</span>
                      </td>
                      <td className="r num">{kwh(p.start.reading)}</td>
                      <td colSpan={4} className="v3-sub-sub">
                        billing starts here
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
        {between.length ? (
          <div className="v3-sub-group">
            <div className="v3-sub-group-head">
              <h4>
                You (owner) <span className="v3-sub-sub">empty unit</span>
              </h4>
              <span className="v3-panel-note">
                {plural(between.length, 'gap')} · no charge
                {between.some(x => x.cost != null)
                  ? ` · ${rm(between.reduce((t, x) => t + (x.cost ?? 0), 0))} at TNB’s cost${between.some(x => x.cost == null) ? ' so far' : ''}`
                  : ' · TNB cost shows once that month’s bill is in'}
              </span>
            </div>
            <p className="v3-panel-note" style={{ margin: 'var(--space-2) 0 0' }}>
              Usage while a unit has no tenant — from a move-out to the next move-in, or a reading saved with no tenant — is yours: billed to you with no charge.
            </p>
            <div className="v3-table-wrap">
              <table className="v3-table v3-prop-table v3-sub-table">
                <thead>
                  <tr>
                    <th>Read on</th>
                    <th className="r">Charge</th>
                    <th>Unit</th>
                    <th className="r">Used</th>
                    <th className="r">At TNB&rsquo;s cost</th>
                    <th>
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {between.map(x => (
                    <tr key={x.id}>
                      <td>
                        {dmy(x.to)}
                        <div className="v3-sub-sub">
                          {plural(x.days, 'day')} from {dmy(x.from)}
                          {byId.get(x.id)?.tenant_name ? `, until ${byId.get(x.id)?.tenant_name} moved in` : ''}
                        </div>
                      </td>
                      <td className="r num v3-sub-sub">No charge</td>
                      <td>{x.unit}</td>
                      <td className="r num">{kwh(x.kwh)} kWh</td>
                      <td className="r num">
                        {x.cost != null ? rm(x.cost) : <span className="v3-sub-sub">needs the TNB bill</span>}
                        {x.cost != null && x.costEstimated ? <i className="v3-sub-est"> est.</i> : null}
                      </td>
                      <td>
                        <DeleteRow id={x.id} kind="reading" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {pnl.rows.length ? <TnbVsBilled pnl={pnl} /> : null}

      <section className="v3-panel" aria-label={`${name} TNB bills`}>
        <div className="v3-panel-head">
          <h3 className="v3-panel-title">TNB bills</h3>
        </div>
        <p className="v3-panel-note" style={{ marginTop: 0 }}>
          What you pay TNB, and how the two meters split it. Months over {HIGH_USE_KWH} kWh add TNB&rsquo;s retail charge and service tax. <i>est.</i> = no kWh on the bill, so the two meters stand in.
        </p>
        {cs.length === 0 ? (
          <p className="v3-empty">No TNB bills yet.</p>
        ) : (
          <div className="v3-table-wrap">
            <table className="v3-table v3-prop-table v3-sub-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th className="r">TNB kWh</th>
                  {units.map(u => (
                    <th key={u} className="r">
                      {u}
                    </th>
                  ))}
                  <th className="r">Meters vs TNB</th>
                  <th className="r">Bill</th>
                  <th className="r">Per kWh</th>
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
                    <td className="r num">
                      {per(c.perKwh)}
                      {c.perKwhFrom === 'submeters' ? <i className="v3-sub-est"> est.</i> : null}
                    </td>
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

    </section>
  )
}

function TenantCard({ p, share: s, paying }: { p: TenantBilling; share: number | null; paying: boolean }) {
  const latest = p.segments[0]
  return (
    <section className="v3-panel v3-prop-card v3-sub-card" data-current={p.current} aria-label={`${who(p.tenant)}, ${p.unit}`}>
      <div className="v3-prop-tenant-head">
        <div>
          <h3 className="v3-chapter-title">{who(p.tenant)}</h3>
          <p className="v3-panel-note" style={{ margin: 0 }}>
            {p.unit} · {p.current ? `billed from ${dmy(p.start.date)} at ${kwh(p.start.reading)}` : `${dmy(p.from)} – ${dmy(p.to)}`}
            {p.movedOut ? ` · final reading ${kwh(p.movedOut.reading)}` : ''}
          </p>
        </div>
        {p.movedOut ? <span className="v3-tag v3-sub-kind">Moved out</span> : p.current ? null : <span className="v3-tag">Earlier tenant</span>}
      </div>
      <div>
        <div className="v3-kpi-label">
          Latest bill · {dmy(latest.from)} – {dmy(latest.to)}
        </div>
        <div className="v3-kpi-value">{rm(latest.charged)}</div>
        <div className="v3-kpi-note">
          {kwh(latest.kwh)} kWh × RM {latest.rate != null ? sen(latest.rate) : '—'} · {plural(latest.days, 'day')}
        </div>
      </div>
      {paying ? (
        <p className="v3-sub-owed" data-owed={p.owed > 0}>
          {p.owed > 0 ? (
            <>
              Still to collect <b className="num">{rm(p.owed)}</b> · {plural(p.owedCount, 'charge')}
            </>
          ) : (
            'Every charge paid'
          )}
        </p>
      ) : null}
      <dl className="v3-prop-deposits">
        <div>
          <dt>Billed in the last 12 months</dt>
          <dd className="num">{rm(p.billed12)}</dd>
        </div>
        <div>
          <dt>Billed in total</dt>
          <dd className="num">
            {rm(p.billed)}
            {p.unrated ? <span className="v3-sub-est"> + {plural(p.unrated, 'reading')} with no rate</span> : null}
          </dd>
        </div>
        <div>
          <dt>Uses a day</dt>
          <dd className="num">{p.perDay != null ? `${p.perDay.toFixed(1)} kWh` : '—'}</dd>
        </div>
      </dl>
      {p.current && s != null ? (
        <div className="v3-sub-share">
          <div className="v3-sub-share-bar" aria-hidden="true">
            <span style={{ width: share(s) }} />
          </div>
          <span className="v3-panel-note">
            {share(s)} of the property&rsquo;s electricity, last 12 months
          </span>
        </div>
      ) : null}
    </section>
  )
}

function ChargeRow({ s, reading, tenants, tagging, paying, earlier }: { s: Segment; reading: Reading | undefined; tenants: string[]; tagging: boolean; paying: boolean; earlier: number }) {
  return (
    <tr data-paid={paying && !!s.paidOn ? true : undefined}>
      <td>
        {dmy(s.to)}
        {s.kind === 'move_out' ? <span className="v3-tag v3-sub-kind"> Final reading</span> : null}
        <div className="v3-sub-sub">
          {plural(s.days, 'day')} from {dmy(s.from)}
        </div>
        {s.flags.length ? (
          <div className="v3-sub-flags">
            {s.flags.map(f => (
              <span key={f} className="v3-tag" data-q="estimated" title={f}>
                {f.replace(/ — check the reading$/, '').replace(/ on this unit's usual/, '')}
              </span>
            ))}
          </div>
        ) : null}
        {reading?.note ? <div className="v3-sub-sub v3-sub-note">{reading.note}</div> : null}
      </td>
      <td className="r num v3-sub-owe">{s.charged != null ? rm(s.charged) : '—'}</td>
      {paying ? (
        <td>
          {s.charged != null && s.charged > 0 ? (
            <PaidCell id={s.id} paidOn={s.paidOn} readOn={s.to} tenant={who(s.tenant)} earlier={earlier} what={`${who(s.tenant)} · ${s.unit} · ${dmy(s.from)} – ${dmy(s.to)} · ${rm(s.charged)}`} />
          ) : null}
        </td>
      ) : null}
      {tagging ? (
        <td>
          <TenantTag id={s.id} tenant={s.tenant} tenants={tenants} />
        </td>
      ) : null}
      <td className="r num">{kwh(reading?.reading)}</td>
      <td className="r num">{kwh(s.kwh)} kWh</td>
      <td className="r num">{s.perDay.toFixed(1)}</td>
      <td className="r num">{s.rate != null ? sen(s.rate) : '—'}</td>
      <td>
        <DeleteRow id={s.id} kind="reading" />
      </td>
    </tr>
  )
}

/** What you paid TNB against what the tenants were billed for the same days — the profit on the electricity.
 *  Kept apart from rent and costs: the tenants' payments come back to you, so only the difference is yours. */
function TnbVsBilled({ pnl }: { pnl: ReturnType<typeof tnbVsTenants> }) {
  const scale = Math.max(1, ...pnl.rows.map(r => Math.abs(r.diff)))
  return (
    <section className="v3-panel" aria-label="TNB paid against billed to tenants">
      <div className="v3-panel-head">
        <h3 className="v3-panel-title">TNB paid vs billed to tenants</h3>
      </div>
      <p className="v3-panel-note" style={{ marginTop: 0 }}>
        Each TNB bill against the tenant charges for the same days (a charge spanning two bills is split by days). The difference is your profit on the electricity — separate from rent and running costs. Single months swing when readings fall between bill dates; the total over many bills is the real figure.
      </p>
      {pnl.n ? (
        <div className="v3-sub-pnl">
          <div>
            <div className="v3-kpi-label">You paid TNB</div>
            <div className="v3-kpi-value">{rm(pnl.tnb)}</div>
            <div className="v3-kpi-note">
              {plural(pnl.n, 'bill')} · {pnl.from ? dmy(pnl.from) : ''} – {pnl.to ? dmy(pnl.to) : ''}
            </div>
          </div>
          <div>
            <div className="v3-kpi-label">Billed to tenants</div>
            <div className="v3-kpi-value">{rm(pnl.billed)}</div>
            <div className="v3-kpi-note">
              {rm(pnl.collected)} collected · {rm(pnl.billed - pnl.collected)} still to collect
            </div>
          </div>
          <div data-tone={pnl.diff >= 0 ? 'pos' : 'neg'}>
            <div className="v3-kpi-label">{pnl.diff >= 0 ? 'Your profit' : 'Your loss'}</div>
            <div className="v3-kpi-value">{rm(pnl.diff)}</div>
            <div className="v3-kpi-note">{pct(pnl.pct)} on what TNB charged</div>
          </div>
        </div>
      ) : (
        <p className="v3-empty">No TNB bill is fully covered by readings yet — read both meters on or after a bill date.</p>
      )}
      <div className="v3-table-wrap">
        <table className="v3-table v3-prop-table v3-sub-table">
          <thead>
            <tr>
              <th>TNB bill</th>
              <th className="r">You paid</th>
              <th className="r">Billed</th>
              <th className="r">Collected</th>
              <th className="r">Difference</th>
              <th>
                <span className="sr-only">Profit or loss</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...pnl.rows].reverse().map(r => (
              <tr key={r.bill.id} data-partial={!r.covered || undefined}>
                <td>
                  {dmy(r.bill.bill_date)}
                  <div className="v3-sub-sub">
                    {dmy(r.start)} – {dmy(r.bill.bill_date)}
                    {r.ownerKwh > 0.05 ? ` · your own use ${kwh(r.ownerKwh)} kWh` : ''}
                  </div>
                  {!r.covered ? <span className="v3-tag">readings don&rsquo;t cover it yet</span> : null}
                </td>
                <td className="r num">{sen(r.tnb)}</td>
                <td className="r num">{sen(r.billed)}</td>
                <td className="r num">{sen(r.collected)}</td>
                <td className="r num v3-sub-diff" data-tone={r.covered ? (r.diff >= 0 ? 'pos' : 'neg') : undefined}>
                  {r.covered ? rm(r.diff) : '—'}
                </td>
                <td className="v3-sub-diffbar">
                  {r.covered ? <span data-tone={r.diff >= 0 ? 'pos' : 'neg'} style={{ width: `${(Math.abs(r.diff) / scale) * 100}%` }} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
