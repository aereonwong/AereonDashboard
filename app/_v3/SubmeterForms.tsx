'use client'

import { useState, useTransition } from 'react'
import { addSubmeterBill, addSubmeterReadings, deleteSubmeterBill, deleteSubmeterReading } from '@/lib/submeter-actions'
import { today } from './pages/property/shared'

// Add forms and delete buttons for the Sub-meter page. Typing a reading or bill that already exists
// for the same unit and date (or bill date) replaces it, so that is how a mistake is corrected.

type Msg = { ok: boolean; text: string } | null

export function ReadingForm({ propertyId, units, rate }: { propertyId: string; units: string[]; rate: number }) {
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
      {units.map(u => (
        <label key={u}>
          <span>{u} meter</span>
          <input type="hidden" name="unit" value={u} />
          <input className="v3-select num" name="reading" inputMode="decimal" autoComplete="off" placeholder="as shown on the meter" />
        </label>
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
        className="v3-btn"
        disabled={pending}
        aria-label={`Delete this ${kind}`}
        onClick={() => {
          if (confirm(`Delete this ${kind}?`))
            start(async () => {
              const r = await (kind === 'reading' ? deleteSubmeterReading(id) : deleteSubmeterBill(id))
              if (!r.ok) setErr(r.error)
            })
        }}
      >
        {pending ? '…' : 'Delete'}
      </button>
      {err ? <span className="v3-prop-msg">{err}</span> : null}
    </span>
  )
}
