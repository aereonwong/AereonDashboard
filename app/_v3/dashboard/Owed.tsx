'use client'

import { useState, useTransition } from 'react'
import { markPaid, markUnpaid, markPaidBefore } from '@/lib/v3/payments'
import type { OwedLine } from '@/lib/v3/studio'
import { OWED_WINDOW_DAYS } from '@/lib/v3/catalog'
import Icon from '@/app/_components/Icon'
import { money, shortDate, longDate } from '../fmt'

// Question 3: who owes me money. Lists invoices TRACKED as unpaid, in exact days
// since issue. `issued` invoices (payment not tracked) are never owed — they are
// only counted, with the bulk "confirm as paid" tool. No due dates, so nothing
// here is called overdue.
//
// The mark runs precisely as long as the days outstanding, against the window.

const age = (d: number) => (d >= 90 ? 'old' : d >= 45 ? 'mid' : 'new')

export default function Owed({
  lines,
  olderCount,
  untracked,
  paidCount,
  today,
}: {
  lines: OwedLine[]
  olderCount: number
  untracked: number
  paidCount: number
  today: string
}) {
  const [done, setDone] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [pending, start] = useTransition()
  const [baseline, setBaseline] = useState(() => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - OWED_WINDOW_DAYS)
    return d.toISOString().slice(0, 10)
  })
  const [msg, setMsg] = useState<string | null>(null)
  const [sort, setSort] = useState<'days' | 'amount' | 'client'>('days')
  const sorted = [...lines].sort((a, b) =>
    sort === 'amount' ? b.amount - a.amount : sort === 'client' ? a.client.localeCompare(b.client) : b.days - a.days,
  )

  const toggle = (id: number) => {
    setBusy(id)
    const wasPaid = !!done[id]
    start(async () => {
      const res = wasPaid ? await markUnpaid(id) : await markPaid(id)
      if (res.ok) setDone(d => ({ ...d, [id]: !wasPaid }))
      else setMsg(res.error ?? 'That did not save.')
      setBusy(null)
    })
  }

  const runBaseline = () => {
    if (!window.confirm(`Mark every invoice issued on or before ${longDate(baseline)} as paid? You can undo any single one afterwards.`)) return
    start(async () => {
      const res = await markPaidBefore(baseline)
      setMsg(res.ok ? `${res.count} invoice${res.count === 1 ? '' : 's'} confirmed as paid.` : res.error ?? 'That did not save.')
    })
  }

  const open = lines.filter(l => !done[l.id])

  return (
    <div>
      {lines.length === 0 ? (
        <p className="v3-empty">
          {untracked ? (
            <>
              <b>Nothing tracked as owed.</b> {untracked} invoice{untracked === 1 ? ' is' : 's are'} issued with no payment
              status yet, so {untracked === 1 ? 'it isn’t' : 'they aren’t'} counted as owed.
            </>
          ) : (
            <>
              <b>Nothing waiting.</b> Every invoice from the last {OWED_WINDOW_DAYS} days is confirmed as paid.
            </>
          )}
        </p>
      ) : (
        <>
        <div className="v3-seg" role="group" aria-label="Sort" style={{ marginBottom: 'var(--space-3)' }}>
          {([
            ['days', 'Longest waiting'],
            ['amount', 'Largest'],
            ['client', 'Client A–Z'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="v3-rows">
          {sorted.map(l => (
            <div className="v3-row" key={l.id} style={{ opacity: done[l.id] ? 0.45 : 1 }}>
              <div className="v3-row-main">
                <div className="v3-row-title">{l.client}</div>
                <div className="v3-row-sub">
                  <span className="code">{l.no}</span> · issued {shortDate(l.date)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="v3-row-num">{money(l.amount, l.currency)}</span>
                <button
                  type="button"
                  className="v3-btn"
                  onClick={() => toggle(l.id)}
                  disabled={busy === l.id}
                  aria-pressed={!!done[l.id]}
                >
                  {done[l.id] ? (
                    <>Undo</>
                  ) : (
                    <>
                      <Icon name="check" /> Paid
                    </>
                  )}
                </button>
              </div>
              <div className="v3-owed-days">
                <span className="v3-owed-track">
                  <i data-age={age(l.days)} style={{ ['--w' as string]: Math.min(1, l.days / OWED_WINDOW_DAYS).toFixed(3) }} />
                </span>
                <span className="v3-owed-label">{l.days} days</span>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      <div className="v3-owed-foot">
        {open.length && paidCount === 0 ? (
          <span className="v3-note">Payment tracking starts today — nothing had been marked paid before.</span>
        ) : null}
        {olderCount > 0 || untracked > 0 ? (
          <>
            <span>
              {olderCount > 0
                ? `${olderCount} older unpaid invoice${olderCount === 1 ? '' : 's'}. `
                : ''}
              Confirm everything up to
            </span>
            <input
              className="v3-date"
              type="date"
              value={baseline}
              max={today}
              onChange={e => setBaseline(e.target.value)}
              aria-label="Confirm invoices issued on or before"
            />
            <button type="button" className="v3-btn" onClick={runBaseline} disabled={pending}>
              Confirm as paid
            </button>
          </>
        ) : null}
        {msg ? <span role="status">{msg}</span> : null}
      </div>
    </div>
  )
}
