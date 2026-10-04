'use client'

import { Fragment, useState, useTransition } from 'react'
import { addPropertyCost, addTenancyTerm, deletePropertyCost, deleteTenancyTerm } from '@/lib/property-actions'
import { KIND_LABEL, type Cost, type Tenancy } from '@/lib/tenancy-math'

// Add and edit forms for the tenancy panel. Every form is both: with an `initial` row it saves over
// that row (hidden `id` field), without one it adds a new row and clears. Tables edit in place:
// press Edit and the row opens its form underneath.

type Msg = { ok: boolean; text: string } | null
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dmy = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const sen = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CostForm({ propertyId, rent, initial, onDone }: { propertyId: string; rent: number | null; initial?: Cost; onDone?: () => void }) {
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
          <option value="repair">Repair</option>
          <option value="maintenance_fee">Maintenance fee</option>
          <option value="agent_fee">Agent fee</option>
          <option value="stamping_fee">Stamping fee (tenancy agreement)</option>
          <option value="other">Other</option>
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
  onDone,
}: {
  propertyId: string
  initial?: Tenancy
  from?: string
  rent?: number | null
  tenant?: string | null
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
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
        <span>Starts</span>
        <input className="v3-select" type="date" name="start_date" defaultValue={initial?.start_date ?? from} required />
      </label>
      <label>
        <span>Ends (last day)</span>
        <input className="v3-select" type="date" name="end_date" defaultValue={initial?.end_date} required />
      </label>
      <label>
        <span>Rent per month (RM)</span>
        <input className="v3-select num" name="monthly_rent" inputMode="decimal" autoComplete="off" defaultValue={initial ? (initial.monthly_rent ?? '') : (rent ?? '')} />
      </label>
      <label>
        <span>Deposit (RM)</span>
        <input className="v3-select num" name="deposit" inputMode="decimal" autoComplete="off" defaultValue={initial?.deposit ?? ''} />
      </label>
      <label>
        <span>Tenant</span>
        <input className="v3-select" name="tenant_name" autoComplete="off" maxLength={120} defaultValue={initial ? (initial.tenant_name ?? '') : (tenant ?? '')} />
      </label>
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

export function CostTable({ costs, rent }: { costs: Cost[]; rent: number | null }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
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
          {costs.map(c => (
            <Fragment key={c.id}>
              <tr>
                <td>{dmy(c.cost_date)}</td>
                <td>{KIND_LABEL[c.kind]}</td>
                <td className="num">{sen(c.amount)}</td>
                <td>{[c.description, c.vendor].filter(Boolean).join(' · ') || '—'}</td>
                <td>
                  <RowButtons editing={open === c.id} toggle={() => setOpen(open === c.id ? null : c.id)} remove={() => deletePropertyCost(c.id)} what="cost" />
                </td>
              </tr>
              {open === c.id ? (
                <tr className="v3-prop-edit">
                  <td colSpan={5}>
                    <CostForm propertyId={c.property_id} rent={rent} initial={c} onDone={() => setOpen(null)} />
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

export function TermTable({ terms, today: now }: { terms: Tenancy[]; today: string }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="v3-table-wrap">
      <table className="v3-table v3-prop-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Rent / month</th>
            <th>Deposit</th>
            <th>Tenant</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Edit or delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {terms.map(t => (
            <Fragment key={t.id}>
              <tr title={t.notes ?? undefined}>
                <td>
                  {dmy(t.start_date)} – {dmy(t.end_date)}
                </td>
                <td className="num">{sen(t.monthly_rent)}</td>
                <td className="num">{sen(t.deposit)}</td>
                <td>{t.tenant_name ?? '—'}</td>
                <td>{t.start_date > now ? 'Upcoming' : t.end_date < now ? 'Ended' : 'Current'}</td>
                <td>
                  <RowButtons editing={open === t.id} toggle={() => setOpen(open === t.id ? null : t.id)} remove={() => deleteTenancyTerm(t.id)} what="term" />
                </td>
              </tr>
              {open === t.id ? (
                <tr className="v3-prop-edit">
                  <td colSpan={6}>
                    <TermForm propertyId={t.property_id} initial={t} onDone={() => setOpen(null)} />
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
