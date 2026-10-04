'use client'

import { useState, useTransition } from 'react'
import { recordLoanMonth } from '@/lib/property-actions'

// The monthly job in one field: the outstanding balance from the statement. The instalment carries
// over from last month; the statement's interest figure is optional (worked out when blank).

type Option = { month: string; label: string; instalment: number | null }
const sen = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LoanRecord({
  propertyId,
  options,
  last,
}: {
  propertyId: string
  options: Option[]
  last: { month: string; outstanding: number } | null
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [month, setMonth] = useState(options[0]?.month ?? '')
  const chosen = options.find(o => o.month === month)

  if (!options.length) return <p className="v3-empty">Every month up to now is recorded.</p>

  return (
    <form
      className="v3-prop-form"
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await recordLoanMonth(form)
          setMsg(r.ok ? { ok: true, text: `Saved ${chosen?.label ?? ''}.` } : { ok: false, text: r.error })
        })
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      {options.length > 1 ? (
        <label>
          <span>Month</span>
          <select className="v3-select" name="month" value={month} onChange={e => setMonth(e.target.value)}>
            {options.map(o => (
              <option key={o.month} value={o.month}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="month" value={month} />
      )}
      <label>
        <span>Outstanding balance (RM)</span>
        <input className="v3-select num" name="outstanding" inputMode="decimal" autoComplete="off" placeholder="e.g. 370,630.12" required />
      </label>
      {last ? (
        <p className="v3-panel-note">
          {last.month}: RM {sen(last.outstanding)}
        </p>
      ) : null}
      <details>
        <summary>Instalment changed, or the statement shows the interest?</summary>
        <label>
          <span>Instalment (RM)</span>
          <input
            className="v3-select num"
            name="instalment"
            inputMode="decimal"
            autoComplete="off"
            placeholder={chosen?.instalment != null ? sen(chosen.instalment) : ''}
          />
        </label>
        <label>
          <span>Interest charged (RM, from the statement)</span>
          <input className="v3-select num" name="interest" inputMode="decimal" autoComplete="off" placeholder="leave blank to work it out" />
        </label>
        <label>
          <span>Note</span>
          <input className="v3-select" name="note" autoComplete="off" maxLength={500} />
        </label>
      </details>
      <button className="v3-btn v3-btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}
