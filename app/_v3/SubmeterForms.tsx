'use client'

import { useState, useTransition } from 'react'
import { addSubmeterBill, addSubmeterReadings, deleteSubmeterBill, deleteSubmeterReading, setReadingTenant } from '@/lib/submeter-actions'
import Icon from '@/app/_components/Icon'
import { today } from './pages/property/shared'

// Add forms and delete buttons for the Sub-meter page. Typing a reading or bill that already exists
// for the same unit and date (or bill date) replaces it, so that is how a mistake is corrected.

type Msg = { ok: boolean; text: string } | null

/** One meter per unit, each billed to a tenant (preset to whoever the unit's last reading was billed to). */
export function ReadingForm({ propertyId, units, tenants, rate, tagging }: { propertyId: string; units: { unit: string; tenant: string | null }[]; tenants: string[]; rate: number; tagging: boolean }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const fid = `reading-${propertyId}`
  return (
    <form
      className="v3-prop-form"
      id={fid}
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await addSubmeterReadings(form)
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
          if (r.ok) (document.getElementById(fid) as HTMLFormElement | null)?.reset()
        })
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <label>
        <span>Date you read the meters</span>
        <input className="v3-select" type="date" name="read_on" defaultValue={today()} required />
      </label>
      {units.map(({ unit, tenant }) => (
        <fieldset key={unit} className="v3-sub-meter">
          <legend>{unit}</legend>
          <input type="hidden" name="unit" value={unit} />
          <label>
            <span>Meter reading</span>
            <input className="v3-select num" name="reading" inputMode="decimal" autoComplete="off" placeholder="as shown on the meter" />
          </label>
          {tagging ? (
            <label>
              <span>Billed to</span>
              <select className="v3-select" name="tenant" defaultValue={tenant ?? ''}>
                <option value="">No tenant (empty unit)</option>
                {tenants.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="tenant" value="" />
          )}
        </fieldset>
      ))}
      <details>
        <summary>Rate and note</summary>
        <label>
          <span>Rate charged for this usage (RM per kWh)</span>
          <input className="v3-select num" name="rate" inputMode="decimal" autoComplete="off" defaultValue={rate} required />
        </label>
        <label>
          <span>Note</span>
          <input className="v3-select" name="note" autoComplete="off" maxLength={300} />
        </label>
      </details>
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save readings'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

export function BillForm({ propertyId }: { propertyId: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const fid = `bill-${propertyId}`
  return (
    <form
      className="v3-prop-form"
      id={fid}
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await addSubmeterBill(form)
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
          if (r.ok) (document.getElementById(fid) as HTMLFormElement | null)?.reset()
        })
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <label>
        <span>Bill date (the 12th)</span>
        <input className="v3-select" type="date" name="bill_date" required />
      </label>
      <label>
        <span>Amount (RM)</span>
        <input className="v3-select num" name="amount" inputMode="decimal" autoComplete="off" placeholder="e.g. 275.35" required />
      </label>
      <label>
        <span>Units billed (kWh)</span>
        <input className="v3-select num" name="kwh" inputMode="decimal" autoComplete="off" placeholder="e.g. 638" />
      </label>
      <details>
        <summary>kW, kVARh and a note (for reference)</summary>
        <label>
          <span>kW</span>
          <input className="v3-select num" name="kw" inputMode="decimal" autoComplete="off" />
        </label>
        <label>
          <span>kVARh</span>
          <input className="v3-select num" name="kvarh" inputMode="decimal" autoComplete="off" />
        </label>
        <label>
          <span>Note</span>
          <input className="v3-select" name="note" autoComplete="off" maxLength={300} />
        </label>
      </details>
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save bill'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

export function DeleteRow({ id, kind }: { id: number; kind: 'reading' | 'bill' }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <span className="v3-prop-actions">
      <button
        type="button"
        className="v3-btn v3-sub-del"
        disabled={pending}
        aria-label={`Delete this ${kind}`}
        title={`Delete this ${kind}`}
        onClick={() => {
          if (confirm(`Delete this ${kind}?`))
            start(async () => {
              const r = await (kind === 'reading' ? deleteSubmeterReading(id) : deleteSubmeterBill(id))
              if (!r.ok) setErr(r.error)
            })
        }}
      >
        {pending ? '…' : <Icon name="close" />}
      </button>
      {err ? <span className="v3-prop-msg">{err}</span> : null}
    </span>
  )
}

/** Who a reading's usage is billed to, changed in place from the charges table. */
export function TenantTag({ id, tenant, tenants }: { id: number; tenant: string | null; tenants: string[] }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const options = tenant && !tenants.includes(tenant) ? [tenant, ...tenants] : tenants
  return (
    <span className="v3-prop-actions">
      <select
        className="v3-select v3-sub-tag"
        aria-label="Billed to"
        defaultValue={tenant ?? ''}
        disabled={pending}
        data-empty={!tenant}
        onChange={e => {
          const v = e.currentTarget.value
          setErr(null)
          start(async () => {
            const r = await setReadingTenant(id, v)
            if (!r.ok) setErr(r.error)
          })
        }}
      >
        <option value="">Not tagged</option>
        {options.map(t => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {err ? <span className="v3-prop-msg">{err}</span> : null}
    </span>
  )
}
