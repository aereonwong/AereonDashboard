'use client'

import { Fragment, useState, useTransition } from 'react'
import { addPropertyCost, addTenancyTerm, deletePropertyCost, deleteTenancyTerm, renameTenant } from '@/lib/property-actions'
import { DEPOSIT_FIELDS, KIND_LABEL, type Cost, type CostKind, type Tenancy } from '@/lib/tenancy-math'
import { dmy, sen, today } from './pages/property/shared'

// Add and edit forms for the Property pages. Every form is both: with an `initial` row it saves over
// that row (hidden `id` field), without one it adds a new row. Tables edit in place: press Edit and
// the row opens its form underneath.

type Msg = { ok: boolean; text: string } | null
const PAGE = 10

export function CostForm({
  propertyId,
  rent,
  tenants,
  initial,
  onDone,
}: {
  propertyId: string
  rent: number | null
  tenants: string[]
  initial?: Cost
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const fid = `cost-${propertyId}-${initial?.id ?? 'new'}`
  return (
    <form
      className="v3-prop-form"
      id={fid}
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await addPropertyCost(form)
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
          if (r.ok) {
            if (!initial) (document.getElementById(fid) as HTMLFormElement | null)?.reset()
            onDone?.()
          }
        })
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <label>
        <span>What was it</span>
        <select className="v3-select" name="kind" defaultValue={initial?.kind ?? 'repair'}>
          {(Object.keys(KIND_LABEL) as CostKind[]).map(k => (
            <option key={k} value={k}>
              {k === 'stamping_fee' ? 'Stamping fee (tenancy agreement)' : KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Amount (RM)</span>
        <input className="v3-select num" name="amount" id={`amt-${fid}`} inputMode="decimal" autoComplete="off" placeholder="e.g. 350" defaultValue={initial?.amount ?? ''} required />
      </label>
      {rent != null ? (
        <label>
          <span>…or months of rent (agent fee: 1, or 1.5 for a 2-year renewal)</span>
          <input
            className="v3-select num"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 1.5"
            aria-label="Months of rent"
            onChange={e => {
              const n = Number(e.target.value)
              const amt = document.getElementById(`amt-${fid}`) as HTMLInputElement | null
              if (amt && Number.isFinite(n) && n > 0) amt.value = String(Math.round(n * rent * 100) / 100)
            }}
          />
        </label>
      ) : null}
      <label>
        <span>Date of the bill</span>
        <input className="v3-select" type="date" name="cost_date" defaultValue={initial?.cost_date ?? today()} required />
      </label>
      <label>
        <span>What for</span>
        <input className="v3-select" name="description" autoComplete="off" maxLength={300} placeholder="e.g. aircond service" defaultValue={initial?.description ?? ''} />
      </label>
      <label>
        <span>Paid to</span>
        <input className="v3-select" name="vendor" autoComplete="off" maxLength={120} defaultValue={initial?.vendor ?? ''} />
      </label>
      {tenants.length ? (
        <label>
          <span>Belongs to a tenant? (agent fee, stamping — leave blank for the property&rsquo;s own)</span>
          <select className="v3-select" name="tenant_name" defaultValue={initial?.tenant_name ?? ''}>
            <option value="">The property</option>
            {tenants.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {tenants.length ? (
        <label className="v3-prop-check">
          <input type="checkbox" name="recovered_from_deposit" defaultChecked={initial?.recovered_from_deposit ?? false} />
          <span>Deducted from that tenant&rsquo;s deposit, so not a cost to me (needs a tenant above)</span>
        </label>
      ) : null}
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : initial ? 'Save changes' : 'Add cost'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

export function TermForm({
  propertyId,
  initial,
  from,
  rent,
  tenant,
  lockTenant,
  tenants = [],
  onDone,
}: {
  propertyId: string
  initial?: Tenancy
  from?: string
  rent?: number | null
  tenant?: string | null
  lockTenant?: boolean
  tenants?: string[]
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const money = (v: number | null | undefined) => v ?? ''
  const listId = `tn-${propertyId}-${initial?.id ?? 'new'}`
  return (
    <form
      className="v3-prop-form"
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await addTenancyTerm(form)
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
          if (r.ok) onDone?.()
        })
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <label>
        <span>Tenant</span>
        <input
          className="v3-select"
          name="tenant_name"
          autoComplete="off"
          maxLength={120}
          list={listId}
          defaultValue={initial ? (initial.tenant_name ?? '') : (tenant ?? '')}
          readOnly={lockTenant}
          placeholder="Name, so terms can be grouped"
        />
        <datalist id={listId}>
          {tenants.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label>
        <span>Starts</span>
        <input className="v3-select" type="date" name="start_date" defaultValue={initial?.start_date ?? from} required />
      </label>
      <label>
        <span>Ends (last day)</span>
        <input className="v3-select" type="date" name="end_date" defaultValue={initial?.end_date} required />
      </label>
      <label>
        <span>Rent per month (RM)</span>
        <input className="v3-select num" name="monthly_rent" inputMode="decimal" autoComplete="off" defaultValue={initial ? money(initial.monthly_rent) : money(rent)} />
      </label>
      <details open={!!initial && (DEPOSIT_FIELDS.some(f => initial[f.key] != null) || initial.deposit_refunded != null)}>
        <summary>Deposits collected at signing</summary>
        {DEPOSIT_FIELDS.map(f => (
          <label key={f.key}>
            <span>{f.label} (RM)</span>
            <input className="v3-select num" name={f.key} inputMode="decimal" autoComplete="off" defaultValue={money(initial?.[f.key])} />
          </label>
        ))}
        <label>
          <span>Paid back to the tenant at the end (RM)</span>
          <input className="v3-select num" name="deposit_refunded" inputMode="decimal" autoComplete="off" defaultValue={money(initial?.deposit_refunded)} />
        </label>
      </details>
      <label>
        <span>Note</span>
        <input className="v3-select" name="notes" autoComplete="off" maxLength={500} defaultValue={initial?.notes ?? ''} />
      </label>
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : initial ? 'Save changes' : 'Add term'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

/** The tenant's name, with a Rename that changes every term and tagged bill of the group at once. */
export function TenantName({ propertyId, name, termIds }: { propertyId: string; name: string | null; termIds: number[] }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  if (!editing)
    return (
      <span className="v3-prop-tenantname">
        <span className="v3-chapter-title">{name ?? 'Tenant not named yet'}</span>
        <button type="button" className="v3-btn" onClick={() => setEditing(true)}>
          {name ? 'Rename' : 'Name the tenant'}
        </button>
      </span>
    )
  return (
    <form
      className="v3-prop-tenantname"
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await renameTenant(propertyId, termIds, name, String(form.get('name') ?? ''))
          if (r.ok) setEditing(false)
          else setMsg(r.error)
        })
      }}
    >
      <input className="v3-select" name="name" defaultValue={name ?? ''} maxLength={120} autoComplete="off" aria-label="Tenant name" autoFocus required />
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button className="v3-btn" type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {msg ? <span className="v3-prop-msg">{msg}</span> : null}
    </form>
  )
}

function RowButtons({ editing, toggle, remove, what }: { editing: boolean; toggle: () => void; remove: () => Promise<unknown>; what: string }) {
  const [pending, start] = useTransition()
  return (
    <span className="v3-prop-actions">
      <button type="button" className="v3-btn" aria-expanded={editing} onClick={toggle}>
        {editing ? 'Close' : 'Edit'}
      </button>
      <button
        type="button"
        className="v3-btn"
        disabled={pending}
        aria-label={`Delete this ${what}`}
        onClick={() => {
          if (confirm(`Delete this ${what}?`)) start(async () => void (await remove()))
        }}
      >
        {pending ? '…' : 'Delete'}
      </button>
    </span>
  )
}

/** The running-costs list: filter by kind, ten to a page, edit or delete in place. */
export function CostsBrowser({ costs, rent, tenants }: { costs: Cost[]; rent: number | null; tenants: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const [kind, setKind] = useState<CostKind | ''>('')
  const [page, setPage] = useState(0)
  const rows = costs
    .filter(c => !kind || c.kind === kind)
    .sort((a, b) => b.cost_date.localeCompare(a.cost_date) || b.id - a.id)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const at = Math.min(page, pages - 1)
  const shown = rows.slice(at * PAGE, at * PAGE + PAGE)
  const total = Math.round(rows.filter(c => !c.recovered_from_deposit).reduce((a, c) => a + c.amount, 0) * 100) / 100
  const recovered = Math.round(rows.filter(c => c.recovered_from_deposit).reduce((a, c) => a + c.amount, 0) * 100) / 100

  return (
    <div>
      <div className="v3-prop-filter">
        <label>
          <span className="sr-only">Show</span>
          <select
            className="v3-select"
            value={kind}
            onChange={e => {
              setKind(e.target.value as CostKind | '')
              setPage(0)
              setOpen(null)
            }}
          >
            <option value="">All kinds</option>
            {(Object.keys(KIND_LABEL) as CostKind[]).map(k => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <span className="v3-panel-note">
          {rows.length} bill{rows.length === 1 ? '' : 's'} · RM {sen(total)} to you{recovered ? ` · RM ${sen(recovered)} recovered from deposits` : ''}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="v3-empty">Nothing here yet.</p>
      ) : (
        <div className="v3-table-wrap">
          <table className="v3-table v3-prop-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>What for</th>
                <th>
                  <span className="sr-only">Edit or delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(c => (
                <Fragment key={c.id}>
                  <tr data-recovered={c.recovered_from_deposit || undefined}>
                    <td>{dmy(c.cost_date)}</td>
                    <td>{KIND_LABEL[c.kind]}</td>
                    <td className="num">{sen(c.amount)}</td>
                    <td>{[c.description, c.vendor, c.tenant_name ? `for ${c.tenant_name}` : null, c.recovered_from_deposit ? 'deducted from deposit — not your cost' : null].filter(Boolean).join(' · ') || '—'}</td>
                    <td>
                      <RowButtons editing={open === c.id} toggle={() => setOpen(open === c.id ? null : c.id)} remove={() => deletePropertyCost(c.id)} what="cost" />
                    </td>
                  </tr>
                  {open === c.id ? (
                    <tr className="v3-prop-edit">
                      <td colSpan={5}>
                        <CostForm propertyId={c.property_id} rent={rent} tenants={tenants} initial={c} onDone={() => setOpen(null)} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav className="v3-pager" aria-label="Pages">
          <button type="button" className="v3-btn" disabled={at === 0} onClick={() => { setPage(at - 1); setOpen(null) }}>
            ← Newer
          </button>
          <span className="v3-panel-note">
            {at * PAGE + 1}–{Math.min(rows.length, at * PAGE + PAGE)} of {rows.length}
          </span>
          <button type="button" className="v3-btn" disabled={at >= pages - 1} onClick={() => { setPage(at + 1); setOpen(null) }}>
            Older →
          </button>
        </nav>
      ) : null}
    </div>
  )
}

/** One tenant's terms, oldest first: the original term, then each extension. */
export function TermTable({ terms, today: now, tenants }: { terms: Tenancy[]; today: string; tenants: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="v3-table-wrap">
      <table className="v3-table v3-prop-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Dates</th>
            <th>Rent / month</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Edit or delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t, i) => (
            <Fragment key={t.id}>
              <tr title={t.notes ?? undefined}>
                <td>{i === 0 ? 'Original' : terms.length > 2 ? `Extension ${i}` : 'Extension'}</td>
                <td>
                  {dmy(t.start_date)} – {dmy(t.end_date)}
                </td>
                <td className="num">{sen(t.monthly_rent)}</td>
                <td>{t.start_date > now ? 'Upcoming' : t.end_date < now ? 'Ended' : 'Current'}</td>
                <td>
                  <RowButtons editing={open === t.id} toggle={() => setOpen(open === t.id ? null : t.id)} remove={() => deleteTenancyTerm(t.id)} what="term" />
                </td>
              </tr>
              {open === t.id ? (
                <tr className="v3-prop-edit">
                  <td colSpan={5}>
                    <TermForm propertyId={t.property_id} initial={t} tenants={tenants} onDone={() => setOpen(null)} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
