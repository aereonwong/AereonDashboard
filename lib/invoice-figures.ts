import type { DriveStatus } from './invoice-drive'

// 👉 The pure half of lib/invoice-details.ts — types and arithmetic only, no
// database import — so the Invoice Details table (a client component) can
// recompute its figures in the browser as the filters change.

/** How an invoice's money stands.
 *  - untracked: status `issued` — documented, payment never tracked (the whole
 *    imported back catalogue). Never counted as paid, owed or overdue.
 *  - outstanding: tracked and not yet paid.
 *  - overdue: outstanding with a due date in the past.
 *  - paid. */
export type Payment = 'paid' | 'outstanding' | 'overdue' | 'untracked'

// The three payment terms that actually appear across the recent invoices —
// the wording the Telegram interview and Create Invoice both print.
export const TERMS: Record<string, string> = {
  half: 'A non-refundable deposit of 50% is required to commence the work\nremaining 50% balance is due upon project delivered and signed off',
  ondelivery: 'Full payment is due upon delivery of the content',
  net30: 'Payment to be initiated within 30 days of posting',
}

export type DetailRow = {
  id: number
  no: string
  date: string
  client: string
  project: string
  amount: number
  currency: string
  payment: Payment
  dueDate: string | null
  paidAt: string | null
  drive: DriveStatus
  driveUrl: string | null
  driveError: string | null
  canvaUrl: string | null
  hasDesign: boolean
  createdAt: string
  source: string
  /** The form values to edit this invoice with, or null when it is view only. */
  edit: EditValues | null
  /** Why it can't be edited, shown as the Edit button's tooltip. */
  editBlock: string | null
  /** The Canva design the edit form opened against — a save is refused if it changed meanwhile. */
  designId: string | null
  /** The last edit, when there is one to undo. */
  undo: { at: string } | null
}

/** An invoice's details as the Create / Edit Invoice form holds them (all strings,
 *  like the inputs). Built on the server from the row, so the form opens filled in. */
export type EditValues = {
  client: string
  contact: string
  address: string
  reg: string
  job: string
  venue: string
  eventDate: string
  eventDateLabel: string
  eventTime: string
  deliverables: string
  amount: string
  currency: 'MYR' | 'USD' | 'SGD' | 'EUR' | 'RMB'
  discount: string
  termsKey: 'half' | 'ondelivery' | 'net30' | 'custom'
  terms: string
  quotation: string
  date: string
  dueDate: string
  status: 'waiting' | 'paid' | 'issued'
}

export type StatusFigures = {
  count: number
  totalRM: number
  foreign: { currency: string; total: number; count: number }[]
  paidRM: number
  paidCount: number
  outstandingRM: number
  outstandingCount: number
  overdueRM: number
  overdueCount: number
  untrackedCount: number
  untrackedRM: number
  driveUploaded: number
  drivePending: number // not uploaded, failed, or stuck — needs a click
}

/** The figures both pages show. Money is ringgit only; other currencies are
 *  counted and listed beside it, never added in. */
export function statusFigures(list: DetailRow[]): StatusFigures {
  const rm = list.filter(r => r.currency === 'MYR')
  const sum = (xs: DetailRow[]) => xs.reduce((s, r) => s + r.amount, 0)
  const of = (p: Payment) => rm.filter(r => r.payment === p)
  const foreign = new Map<string, { total: number; count: number }>()
  for (const r of list.filter(x => x.currency !== 'MYR')) {
    const cur = foreign.get(r.currency) ?? { total: 0, count: 0 }
    foreign.set(r.currency, { total: cur.total + r.amount, count: cur.count + 1 })
  }
  const outstanding = rm.filter(r => r.payment === 'outstanding' || r.payment === 'overdue')
  return {
    count: list.length,
    totalRM: sum(rm),
    foreign: [...foreign.entries()].map(([currency, v]) => ({ currency, ...v })),
    paidRM: sum(of('paid')),
    paidCount: list.filter(r => r.payment === 'paid').length,
    outstandingRM: sum(outstanding),
    outstandingCount: list.filter(r => r.payment === 'outstanding' || r.payment === 'overdue').length,
    overdueRM: sum(of('overdue')),
    overdueCount: list.filter(r => r.payment === 'overdue').length,
    untrackedCount: list.filter(r => r.payment === 'untracked').length,
    untrackedRM: sum(of('untracked')),
    driveUploaded: list.filter(r => r.drive === 'uploaded').length,
    drivePending: list.filter(r => r.drive !== 'uploaded').length,
  }
}

export type KnownClient = { name: string; contact?: string; address?: string; reg?: string }

export type FormOptions = {
  clients: KnownClient[]
  venues: string[]
  quotations: { no: string; client: string }[]
  today: string
}
