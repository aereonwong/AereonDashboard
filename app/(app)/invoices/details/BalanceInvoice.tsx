'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@/app/_components/Icon'
import { previewBalance, saveBalance, discardInvoice } from '../actions'
import type { RenderPreview } from '@/lib/invoice-canva'

// 👉 Raise the balance of a deposit invoice (lib/invoice-split.ts). One field —
// the date — then Canva copies the deposit's own design and rewrites it as the
// balance: next free number, QTY = the rest of the %, totals = contract − deposit,
// and the two split lines under Payment Terms. Preview → Save, or Discard.

export type BalanceTarget = { id: number; no: string; client: string; percent: number }

type Phase = 'pick' | 'rendering' | 'preview' | 'saving'

export default function BalanceInvoice({
  target,
  today,
  onClose,
  onSaved,
}: {
  target: BalanceTarget
  today: string
  onClose: () => void
  onSaved: (no: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [date, setDate] = useState(today)
  const [phase, setPhase] = useState<Phase>('pick')
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<{ no: string; preview: RenderPreview } | null>(null)
  const busy = phase === 'rendering' || phase === 'saving'
  const rest = 100 - target.percent

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const close = async () => {
    if (busy) return
    if (shown) await discardInvoice(shown.preview).catch(() => {})
    onClose()
  }

  const draw = async () => {
    setError(null)
    setPhase('rendering')
    const res = await previewBalance(target.id, date).catch(e => ({ ok: false as const, error: String(e) }))
    if (!res.ok) {
      setError(res.error)
      setPhase('pick')
      return
    }
    setShown({ no: res.no, preview: res.preview })
    setPhase('preview')
  }

  const back = async () => {
    if (shown) await discardInvoice(shown.preview).catch(() => {})
    setShown(null)
    setPhase('pick')
  }

  const save = async () => {
    if (!shown) return
    setError(null)
    setPhase('saving')
    const res = await saveBalance(target.id, date, shown.no, shown.preview).catch(e => ({ ok: false as const, error: String(e) }))
    if (!res.ok) {
      // A refused save has already thrown the preview away.
      setShown(null)
      setError(res.error)
      setPhase('pick')
      return
    }
    onSaved(res.no)
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="idt-dialog idt idt-balance"
      aria-labelledby="idt-balance-title"
      onCancel={e => {
        e.preventDefault()
        close()
      }}
    >
      <div className="idt-dialog-head">
        <h2 id="idt-balance-title">{shown ? `Check ${shown.no}` : `Balance of ${target.no}`}</h2>
        <button type="button" className="idt-act" onClick={close} aria-label="Close" disabled={busy}>
          <Icon name="close" />
        </button>
      </div>

      <div className="idt-dialog-body">
        {error ? (
          <p className="idt-error" role="alert">
            <Icon name="alert" /> {error}
          </p>
        ) : null}

        {phase === 'rendering' ? (
          <div className="idt-wait" role="status">
            <Icon name="refresh" />
            <div>
              <b>Drawing the balance invoice in Canva…</b>
              <br />
              Copying {target.no} and rewriting it. About 15 seconds.
            </div>
          </div>
        ) : shown ? (
          <div className="idt-preview">
            <div className="idt-preview-img">
              {shown.preview.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown.preview.previewUrl} alt={`Preview of invoice ${shown.no}`} />
              ) : (
                <div className="idt-wait">Canva sent no preview image.</div>
              )}
            </div>
            <div>
              <dl>
                <dt>Number</dt>
                <dd className="idt-no">{shown.no}</dd>
                <dt>Client</dt>
                <dd>{target.client}</dd>
                <dt>Bills</dt>
                <dd>The remaining {rest}% of the contract</dd>
                <dt>Deposit</dt>
                <dd>{target.no}</dd>
              </dl>
              <p className="idt-sub">Check the number, QTY {rest}%, the total and the two lines under Payment Terms.</p>
            </div>
          </div>
        ) : (
          <>
            <ul>
              <li>
                A copy of <b>{target.no}</b> becomes the balance invoice for the remaining <b>{rest}%</b> — same client,
                job and wording.
              </li>
              <li>It gets the next free number for the month of its date, and a total of only the balance.</li>
              <li>Under Payment Terms the deposit line becomes &ldquo;Less deposit ({target.no})&rdquo; and the balance line becomes &ldquo;Balance due&rdquo;.</li>
              <li>You see a preview before anything is saved. Google Drive stays a separate click.</li>
            </ul>
            <div className="idt-form">
              <div className="idt-field">
                <label htmlFor="idt-balance-date">Invoice date</label>
                <input id="idt-balance-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <span className="hint">Also decides its number (SYCP-YYYYMM-…).</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="idt-dialog-foot">
        {shown ? (
          <>
            <button type="button" className="idt-btn" onClick={back} disabled={busy}>
              Back
            </button>
            <button type="button" className="idt-btn" onClick={close} disabled={busy}>
              Discard
            </button>
            <button type="button" className="idt-btn primary" onClick={save} disabled={busy}>
              <Icon name={phase === 'saving' ? 'refresh' : 'check'} /> {phase === 'saving' ? 'Saving…' : `Save ${shown.no}`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="idt-btn" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="idt-btn primary" onClick={draw} disabled={busy || !date}>
              <Icon name="design" /> Draw in Canva
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}
