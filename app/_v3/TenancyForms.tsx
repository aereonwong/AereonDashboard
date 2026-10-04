'use client'

import { useState, useTransition } from 'react'
import { addPropertyCost, addTenancyTerm, deletePropertyCost } from '@/lib/property-actions'

// Two small forms and a delete button for the tenancy panel. Both forms clear on success.

type Msg = { ok: boolean; text: string } | null
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

export function CostForm({ propertyId, rent }: { propertyId: string; rent: number | null }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  return (
    <form
      className="v3-prop-form"
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await addPropertyCost(form)
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
          if (r.ok) (document.getElementById(`cost-${propertyId}`) as HTMLFormElement | null)?.reset()
        })
      }}
      id={`cost-${propertyId}`}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <label>
        <span>What was it</span>
        <select className="v3-select" name="kind" defaultValue="repair">
          <option value="repair">Repair</option>
          <option value="maintenance_fee">Maintenance fee</option>
          <option value="agent_fee">Agent fee</option>
          <option value="stamping_fee">Stamping fee (tenancy agreement)</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        <span>Amount (RM)</span>
        <input className="v3-select num" name="amount" id={`amt-${propertyId}`} inputMode="decimal" autoComplete="off" placeholder="e.g. 350" required />
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
              const amt = document.getElementById(`amt-${propertyId}`) as HTMLInputElement | null
              if (amt && Number.isFinite(n) && n > 0) amt.value = String(Math.round(n * rent * 100) / 100)
            }}
          />
        </label>
      ) : null}
      <label>
        <span>Date of the bill</span>
        <input className="v3-select" type="date" name="cost_date" defaultValue={today()} required />
      </label>
      <label>
        <span>What for</span>
        <input className="v3-select" name="description" autoComplete="off" maxLength={300} placeholder="e.g. aircond service" />
      </label>
      <label>
        <span>Paid to</span>
        <input className="v3-select" name="vendor" autoComplete="off" maxLength={120} />
      </label>
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add cost'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

export function TermForm({ propertyId, from, rent, tenant }: { propertyId: string; from: string; rent: number | null; tenant: string | null }) {
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
        })
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <label>
        <span>Starts</span>
        <input className="v3-select" type="date" name="start_date" defaultValue={from} required />
      </label>
      <label>
        <span>Ends (last day)</span>
        <input className="v3-select" type="date" name="end_date" required />
      </label>
      <label>
        <span>Rent per month (RM)</span>
        <input className="v3-select num" name="monthly_rent" inputMode="decimal" autoComplete="off" defaultValue={rent ?? ''} />
      </label>
      <details>
        <summary>Deposit, tenant, note</summary>
        <label>
          <span>Deposit (RM)</span>
          <input className="v3-select num" name="deposit" inputMode="decimal" autoComplete="off" />
        </label>
        <label>
          <span>Tenant</span>
          <input className="v3-select" name="tenant_name" autoComplete="off" maxLength={120} defaultValue={tenant ?? ''} />
        </label>
        <label>
          <span>Note</span>
          <input className="v3-select" name="notes" autoComplete="off" maxLength={500} />
        </label>
      </details>
      <button className="v3-btn" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add term'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

export function DeleteCost({ id }: { id: number }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="v3-btn"
      disabled={pending}
      aria-label="Delete this cost"
      onClick={() => {
        if (confirm('Delete this cost?')) start(async () => void (await deletePropertyCost(id)))
      }}
    >
      {pending ? '…' : 'Delete'}
    </button>
  )
}
