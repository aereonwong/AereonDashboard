'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/app/_components/Icon'
import type { FormOptions, EditValues } from '@/lib/invoice-figures'
import type { RenderPreview } from '@/lib/invoice-canva'
import { previewInvoice, saveInvoice, discardInvoice, previewEdit, saveEdit, type InvoiceForm } from './actions'
import ConfirmDialog from './ConfirmDialog'
import './invoices.css'

// 👉 Create Invoice: a form → Canva draws it → Aereon checks the picture → Save.
// Nothing is filed until Save; Discard (or closing the dialog) throws the Canva
// copy away. Filing the PDF in Google Drive is NOT part of this — that stays a
// separate click on the invoice's row.
//
// Edit mode (the `edit` prop) is the same dialog opened from a row, filled in
// with that invoice: same number, a fresh Canva drawing, and a confirm before
// the old design and Drive PDF are replaced. Undo lives on the row.
//
// Every choice the database already knows is offered rather than retyped:
// clients (with their address, contact and registration number), venues used
// before, quotations on file, and the three payment terms the bot uses.

// The same wording the Telegram interview writes (lib/invoice-intake.ts TERMS).
const TERMS: { key: InvoiceForm['termsKey']; label: string; text: string; days?: number }[] = [
  {
    key: 'half',
    label: '50% deposit, 50% on delivery',
    text: 'A non-refundable deposit of 50% is required to commence the work\nremaining 50% balance is due upon project delivered and signed off',
  },
  { key: 'ondelivery', label: 'Full payment on delivery', text: 'Full payment is due upon delivery of the content' },
  { key: 'net30', label: 'Within 30 days', text: 'Payment to be initiated within 30 days of posting', days: 30 },
  { key: 'custom', label: 'Other — write my own', text: '' },
]
const CURRENCIES = ['MYR', 'USD', 'SGD', 'EUR', 'RMB'] as const

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const fmt = (n: number, cur: string) => `${cur} ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Phase = 'form' | 'rendering' | 'preview' | 'saving'

export type EditTarget = {
  id: number
  no: string
  designId: string
  values: EditValues
  driveUploaded: boolean
  /** Quotations: invoices already raised from it (they are not changed by the edit). */
  invoicedAs?: string[]
}
/** A quote being turned into an invoice: the form opens filled in from it. */
export type QuoteSource = { id: number; no: string; values: Partial<EditValues> }

export default function CreateInvoice({
  options,
  disabled,
  disabledReason,
  onSaved,
  edit,
  fromQuote,
  kind = 'invoice',
  onClose,
}: {
  options: FormOptions
  disabled?: boolean
  disabledReason?: string
  onSaved: (no: string, warning?: string) => void
  /** Open straight away, filled in with this invoice, and save over it. */
  edit?: EditTarget
  /** Open straight away, filled in from this quote, and file a NEW invoice linked to it. */
  fromQuote?: QuoteSource
  /** 'quotation': the same form files a quote — own number series, no payment
   *  status or due date, a validity period instead. Never income. */
  kind?: 'invoice' | 'quotation'
  onClose?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ no: string; preview: RenderPreview } | null>(null)
  const [asking, setAsking] = useState(false)

  const blank = () => ({
    client: '',
    contact: '',
    address: '',
    reg: '',
    job: '',
    venue: '',
    eventDate: options.today,
    eventDateLabel: '',
    eventTime: '',
    deliverables: '',
    amount: '',
    currency: 'MYR' as InvoiceForm['currency'],
    discount: '',
    termsKey: 'ondelivery' as InvoiceForm['termsKey'],
    terms: TERMS[1].text,
    quotation: '',
    date: options.today,
    dueDate: '',
    dueTouched: false,
    status: 'waiting' as InvoiceForm['status'],
    validity: '14',
  })
  // Editing keeps the due date as filed rather than recomputing it from the terms.
  const [f, setF] = useState(() =>
    edit ? { ...blank(), ...edit.values, dueTouched: true } : fromQuote ? { ...blank(), ...fromQuote.values } : blank(),
  )
  const wasPaid = kind !== 'quotation' && edit?.values.status === 'paid'
  // Field ids differ per dialog: Create and Edit can both be on the page at once.
  // Convert always makes an invoice; Create and Edit follow `kind`.
  const isQuote = kind === 'quotation' && !fromQuote
  const doc = isQuote ? 'quotation' : 'invoice'
  const Doc = isQuote ? 'Quotation' : 'Invoice'
  const px = edit ? `ce${edit.id}` : fromQuote ? `cq${fromQuote.id}` : isQuote ? 'nq' : 'ci'

  useEffect(() => {
    if (edit || fromQuote) dialog.current?.showModal()
  }, [edit, fromQuote])
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setF(s => ({ ...s, [k]: v }))

  const clientByName = useMemo(() => new Map(options.clients.map(c => [c.name.toLowerCase(), c])), [options.clients])

  // Picking a known client fills in what the database already holds for them.
  const pickClient = (name: string) => {
    const known = clientByName.get(name.trim().toLowerCase())
    setF(s => ({
      ...s,
      client: name,
      ...(known ? { contact: known.contact ?? '', address: known.address ?? '', reg: known.reg ?? '' } : {}),
    }))
  }

  // Terms with a fixed period set the due date, unless it was typed by hand.
  useEffect(() => {
    if (f.dueTouched) return
    const t = TERMS.find(x => x.key === f.termsKey)
    set('dueDate', t?.days && f.date ? addDays(f.date, t.days) : '')
  }, [f.termsKey, f.date, f.dueTouched])

  const amount = Number(f.amount) || 0
  const discount = Number(f.discount) || 0
  const net = Math.max(amount - discount, 0)
  const known = clientByName.get(f.client.trim().toLowerCase())

  const toForm = (): InvoiceForm => ({
    kind: isQuote ? 'quotation' : 'invoice',
    validityDays: isQuote ? Number(f.validity) : undefined,
    client: { name: f.client.trim(), contact: f.contact, address: f.address.replace(/\s*\n\s*/g, ', '), reg: f.reg },
    job: f.job,
    venue: f.venue,
    eventDate: f.eventDate || undefined,
    eventDateLabel: f.eventDateLabel || undefined,
    eventTime: f.eventTime || undefined,
    deliverables: f.deliverables.split('\n'),
    amount,
    currency: f.currency,
    discount: discount || undefined,
    termsKey: f.termsKey,
    terms: f.terms,
    quotation: f.quotation || undefined,
    // The firm link only holds while the reference still names that quote.
    quotationId: fromQuote && f.quotation.trim() === fromQuote.no ? fromQuote.id : undefined,
    date: f.date,
    dueDate: isQuote ? undefined : f.dueDate || undefined,
    status: f.status,
  })

  const open = () => {
    setError(null)
    setPhase('form')
    dialog.current?.showModal()
  }

  // Closing with a preview on screen means "no" — never leave a stray open edit.
  const close = async () => {
    if (phase === 'rendering' || phase === 'saving') return
    if (preview) {
      const p = preview.preview
      setPreview(null)
      discardInvoice(p).catch(() => {})
    }
    dialog.current?.close()
    onClose?.()
  }

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPhase('rendering')
    const res = await (edit ? previewEdit(edit.id, toForm()) : previewInvoice(toForm())).catch(err => ({ ok: false as const, error: String(err) }))
    if (!res.ok) {
      setError(res.error)
      setPhase('form')
      return
    }
    setPreview({ no: res.no, preview: res.preview })
    setPhase('preview')
  }

  const backToEdit = async () => {
    if (preview) discardInvoice(preview.preview).catch(() => {})
    setPreview(null)
    setPhase('form')
  }

  const save = async () => {
    if (!preview) return
    setAsking(false)
    setError(null)
    setPhase('saving')
    const res = await (edit ? saveEdit(edit.id, toForm(), preview.preview, edit.designId) : saveInvoice(toForm(), preview.no, preview.preview)).catch(
      err => ({ ok: false as const, error: String(err) }),
    )
    if (!res.ok) {
      setError(res.error)
      // A taken number (or a changed invoice) means the preview is gone; anything else can be retried.
      if (/was taken|changed while|View only|not found/.test(res.error)) {
        setPreview(null)
        setPhase('form')
      } else setPhase('preview')
      return
    }
    setPreview(null)
    setF(blank())
    dialog.current?.close()
    setPhase('form')
    onSaved(res.no, 'warning' in res ? res.warning : undefined)
    onClose?.()
  }

  const busy = phase === 'rendering' || phase === 'saving'

  // Edits replace what's in Canva and Drive, so they ask first; a new invoice doesn't.
  const askThenSave = () => (edit ? setAsking(true) : save())

  return (
    <>
      {edit || fromQuote ? null : (
        <button type="button" className="idt-create" onClick={open} disabled={disabled} title={disabled ? disabledReason : undefined}>
          <Icon name="plus" /> Create {doc}
        </button>
      )}

      <dialog
        ref={dialog}
        className="idt-dialog idt"
        aria-labelledby="idt-dialog-title"
        onCancel={e => {
          e.preventDefault()
          close()
        }}
      >
        <div className="idt-dialog-head">
          <h2 id="idt-dialog-title">{phase === 'preview' || phase === 'saving' ? `Check ${preview?.no}` : edit ? `Edit ${edit.no}` : fromQuote ? `Invoice from ${fromQuote.no}` : `Create ${doc}`}</h2>
          <button type="button" className="idt-act" onClick={close} aria-label="Close" disabled={busy}>
            <Icon name="close" />
          </button>
        </div>

        {phase === 'rendering' ? (
          <div className="idt-dialog-body">
            <div className="idt-wait" role="status">
              <Icon name="refresh" />
              <div>
                <b>{edit ? `Redrawing the ${doc} in Canva…` : `Drawing the ${doc} in Canva…`}</b>
                <br />
                Copying the template and filling it in. About 15 seconds.
              </div>
            </div>
          </div>
        ) : phase === 'preview' || phase === 'saving' ? (
          <>
            <div className="idt-dialog-body">
              {error ? (
                <p className="idt-error" role="alert">
                  <Icon name="alert" /> {error}
                </p>
              ) : null}
              <div className="idt-preview">
                <div className="idt-preview-img">
                  {preview?.preview.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.preview.previewUrl} alt={`Preview of ${doc} ${preview.no}`} />
                  ) : (
                    <div className="idt-wait">Canva sent no preview image.</div>
                  )}
                </div>
                <div>
                  <dl>
                    <dt>Number</dt>
                    <dd className="idt-no">{preview?.no}</dd>
                    <dt>Client</dt>
                    <dd>{f.client}</dd>
                    <dt>Job</dt>
                    <dd>{f.job}</dd>
                    <dt>Total</dt>
                    <dd className="idt-num">
                      <b>{fmt(net, f.currency)}</b>
                      {discount ? <span className="idt-sub">after {fmt(discount, f.currency)} discount</span> : null}
                    </dd>
                    <dt>Dated</dt>
                    <dd>{f.date}</dd>
                    {isQuote ? (
                      <>
                        <dt>Valid for</dt>
                        <dd>{f.validity} days</dd>
                      </>
                    ) : (
                      <>
                        <dt>Due</dt>
                        <dd>{f.dueDate || '—'}</dd>
                        <dt>Payment</dt>
                        <dd>{f.status === 'paid' ? 'Already paid' : f.status === 'waiting' ? 'Awaiting payment' : 'Not tracked'}</dd>
                      </>
                    )}
                  </dl>
                  {edit ? (
                    <p className="note">
                      Nothing is changed yet. <b>Save changes</b> asks you to confirm, then replaces the {doc}&apos;s
                      Canva design{isQuote ? '' : ', moves its old Drive PDF to trash'} and updates your records. Same
                      number: <b>{edit.no}</b>.
                    </p>
                  ) : isQuote ? (
                    <p className="note">
                      Nothing is saved yet. <b>Save quotation</b> keeps this Canva design, files it in Canva&apos;s
                      Quotation folder and adds it to Quotations. A quotation is never counted as income — it becomes
                      one when you Convert it to an invoice.
                    </p>
                  ) : (
                  <p className="note">
                    Nothing is saved yet. <b>Save invoice</b> keeps this Canva design, files it in Canva&apos;s
                    Invoices ({f.date.slice(0, 4)}) folder and adds the invoice to your records. Uploading the PDF to
                    Google Drive is a separate step on the invoice&apos;s row.
                  </p>
                  )}
                </div>
              </div>
            </div>
            <div className="idt-dialog-foot">
              <button type="button" className="idt-btn" onClick={backToEdit} disabled={busy}>
                <Icon name="undo" /> Back to edit
              </button>
              <button type="button" className="idt-btn" onClick={close} disabled={busy}>
                Discard
              </button>
              <button type="button" className="idt-btn primary" onClick={askThenSave} disabled={busy}>
                <Icon name="check" /> {phase === 'saving' ? 'Saving…' : edit ? 'Save changes' : `Save ${doc}`}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={generate}>
            <div className="idt-dialog-body">
              {error ? (
                <p className="idt-error" role="alert">
                  <Icon name="alert" /> {error}
                </p>
              ) : null}
              {wasPaid ? (
                <p className="idt-error idt-warn" role="note">
                  <Icon name="alert" /> {edit?.no} is marked paid. Edit only to correct it — the amount should still match
                  what was received.
                </p>
              ) : null}
              {fromQuote ? (
                <p className="idt-error idt-note" role="note">
                  <Icon name="invoice" />
                  <span>
                    Filled in from <b>{fromQuote.no}</b>. Check the amount and scope — change them if the job was confirmed
                    differently, or bill part of it (a deposit or an add-on). The invoice prints{' '}
                    <b>QUOTATION No. {fromQuote.no}</b> and the quote is marked won once it&apos;s saved.
                  </span>
                </p>
              ) : null}
              <div className="idt-form">
                <div className="idt-section">Client</div>
                <div className="idt-field">
                  <label htmlFor={`${px}-client`}>Company</label>
                  <input
                    id={`${px}-client`}
                    list={`${px}-clients`}
                    required
                    autoComplete="off"
                    value={f.client}
                    onChange={e => pickClient(e.target.value)}
                    placeholder="Start typing — known clients fill in their details"
                  />
                  <datalist id={`${px}-clients`}>
                    {options.clients.map(c => (
                      <option key={c.name} value={c.name} />
                    ))}
                  </datalist>
                  <span className="hint">{f.client.trim() ? (known ? 'On file — details filled in' : 'New client — saved for next time') : ' '}</span>
                </div>
                <div className="idt-field">
                  <label htmlFor={`${px}-reg`}>
                    Registration no. <span className="opt">(optional)</span>
                  </label>
                  <input id={`${px}-reg`} value={f.reg} onChange={e => set('reg', e.target.value)} placeholder="e.g. 201901012345" />
                </div>
                <div className="idt-field">
                  <label htmlFor={`${px}-contact`}>
                    Attention <span className="opt">(optional)</span>
                  </label>
                  <input id={`${px}-contact`} value={f.contact} onChange={e => set('contact', e.target.value)} placeholder="Contact person" />
                </div>
                <div className="idt-field">
                  <label htmlFor={`${px}-address`}>Address</label>
                  <textarea
                    id={`${px}-address`}
                    rows={2}
                    value={f.address}
                    onChange={e => set('address', e.target.value)}
                    placeholder="Street, postcode city, country"
                  />
                </div>

                <div className="idt-section">Job</div>
                <div className="idt-field">
                  <label htmlFor={`${px}-job`}>Job name</label>
                  <input id={`${px}-job`} required value={f.job} onChange={e => set('job', e.target.value)} placeholder="e.g. KLCC Drone Show" />
                </div>
                <div className="idt-field">
                  <label htmlFor={`${px}-venue`}>
                    Venue <span className="opt">(optional)</span>
                  </label>
                  <input id={`${px}-venue`} list={`${px}-venues`} value={f.venue} onChange={e => set('venue', e.target.value)} />
                  <datalist id={`${px}-venues`}>
                    {options.venues.map(v => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-edate`}>Job date</label>
                  <input id={`${px}-edate`} type="date" value={f.eventDate} onChange={e => set('eventDate', e.target.value)} />
                </div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-elabel`}>
                    Print date as <span className="opt">(optional)</span>
                  </label>
                  <input
                    id={`${px}-elabel`}
                    value={f.eventDateLabel}
                    onChange={e => set('eventDateLabel', e.target.value)}
                    placeholder="1st to 3rd Sept 2026"
                  />
                </div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-time`}>
                    Time <span className="opt">(optional)</span>
                  </label>
                  <input id={`${px}-time`} value={f.eventTime} onChange={e => set('eventTime', e.target.value)} placeholder="4 hours (4pm – 8pm)" />
                </div>
                <div className="idt-field s6">
                  <label htmlFor={`${px}-deliv`}>Scope of work — one per line</label>
                  <textarea
                    id={`${px}-deliv`}
                    required
                    rows={3}
                    value={f.deliverables}
                    onChange={e => set('deliverables', e.target.value)}
                    placeholder={'1 x IG reel synced to TikTok\n1 x IG story'}
                  />
                </div>

                <div className="idt-section">Money</div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-cur`}>Currency</label>
                  <select id={`${px}-cur`} value={f.currency} onChange={e => set('currency', e.target.value as InvoiceForm['currency'])}>
                    {CURRENCIES.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-amount`}>Price</label>
                  <input
                    id={`${px}-amount`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    value={f.amount}
                    onChange={e => set('amount', e.target.value)}
                  />
                </div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-disc`}>
                    Discount <span className="opt">(own line)</span>
                  </label>
                  <input
                    id={`${px}-disc`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={f.discount}
                    onChange={e => set('discount', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <p className="idt-total">
                  {Doc} total <b>{fmt(net, f.currency)}</b>
                  {f.currency !== 'MYR' ? ' — kept out of ringgit totals' : ''}
                </p>
                <div className="idt-field">
                  <label htmlFor={`${px}-terms`}>Payment terms</label>
                  <select
                    id={`${px}-terms`}
                    value={f.termsKey}
                    onChange={e => {
                      const t = TERMS.find(x => x.key === e.target.value)!
                      setF(s => ({ ...s, termsKey: t.key, terms: t.key === 'custom' ? '' : t.text }))
                    }}
                  >
                    {TERMS.map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isQuote ? (
                  <div className="idt-field">
                    <label htmlFor={`${px}-valid`}>Valid for (days)</label>
                    <input
                      id={`${px}-valid`}
                      type="number"
                      inputMode="numeric"
                      list={`${px}-valids`}
                      min="1"
                      max="365"
                      step="1"
                      required
                      value={f.validity}
                      onChange={e => set('validity', e.target.value)}
                    />
                    <datalist id={`${px}-valids`}>
                      <option value="14" />
                      <option value="30" />
                    </datalist>
                  </div>
                ) : (
                <div className="idt-field">
                  <label htmlFor={`${px}-status`}>Payment status</label>
                  <select id={`${px}-status`} value={f.status} onChange={e => set('status', e.target.value as InvoiceForm['status'])}>
                    <option value="waiting">Awaiting payment</option>
                    <option value="paid">Already paid</option>
                    <option value="issued">Don&apos;t track payment</option>
                  </select>
                </div>
                )}
                {f.termsKey === 'custom' ? (
                  <div className="idt-field s6">
                    <label htmlFor={`${px}-tterms`}>Terms as printed</label>
                    <textarea id={`${px}-tterms`} required rows={2} value={f.terms} onChange={e => set('terms', e.target.value)} />
                  </div>
                ) : null}

                <div className="idt-section">{isQuote ? 'Date' : <>Dates &amp; reference</>}</div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-date`}>{Doc} date</label>
                  <input id={`${px}-date`} type="date" required value={f.date} onChange={e => set('date', e.target.value)} />
                </div>
                {isQuote ? null : (
                <>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-due`}>
                    Due date <span className="opt">(optional)</span>
                  </label>
                  <input
                    id={`${px}-due`}
                    type="date"
                    min={f.date}
                    value={f.dueDate}
                    onChange={e => setF(s => ({ ...s, dueDate: e.target.value, dueTouched: true }))}
                  />
                </div>
                <div className="idt-field s2">
                  <label htmlFor={`${px}-quote`}>
                    Quotation ref <span className="opt">(optional)</span>
                  </label>
                  <input id={`${px}-quote`} list={`${px}-quotes`} value={f.quotation} onChange={e => set('quotation', e.target.value)} />
                  <datalist id={`${px}-quotes`}>
                    {options.quotations.map(q => (
                      <option key={q.no} value={q.no}>
                        {q.client}
                      </option>
                    ))}
                  </datalist>
                </div>
                </>
                )}
              </div>
            </div>
            <div className="idt-dialog-foot">
              <span className="idt-spacer">{edit ? `The number stays ${edit.no}.` : 'The number is issued automatically.'}</span>
              <button type="button" className="idt-btn" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="idt-btn primary">
                <Icon name="eye" /> Preview in Canva
              </button>
            </div>
          </form>
        )}
      </dialog>

      {asking && edit ? (
        <ConfirmDialog
          onCancel={() => setAsking(false)}
          ask={{
            title: `Replace ${edit.no} with this version?`,
            lines: isQuote
              ? [
                  'Canva: this new design becomes the quotation. The old one moves to "TODO: Delete".',
                  'Records: amount, dates and validity update on Quotations. A quotation is never income.',
                  ...(edit.invoicedAs?.length
                    ? [`Already invoiced as ${edit.invoicedAs.join(', ')} — ${edit.invoicedAs.length === 1 ? 'that invoice is' : 'those invoices are'} not changed.`]
                    : []),
                  "You can undo this from the quotation's row.",
                ]
              : [
                  'Canva: this new design becomes the invoice. The old one moves to "TODO: Delete".',
                  edit.driveUploaded
                    ? 'Google Drive: the old PDF moves to Drive\'s trash (kept 30 days) and the row goes back to "Not uploaded". Upload the new PDF from its row.'
                    : 'Google Drive: nothing uploaded yet, nothing to remove.',
                  'Records: amount, dates and payment status update everywhere.',
                  'You can undo this from the invoice\'s row.',
                ],
            warning: wasPaid ? 'This invoice is marked paid. Check the amount still matches what was received.' : undefined,
            confirmLabel: 'Yes, replace',
            onConfirm: save,
          }}
        />
      ) : null}
    </>
  )
}
