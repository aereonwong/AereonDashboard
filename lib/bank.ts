import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode, isIssued, isPaid, type Rec } from './records'
import { quoteLinks } from './quotes'
import { moneyFactor, moneyHidden, scrubAmounts } from './privacy'
import {
  applyPayeeRules, coverage, flowKind, type PayeeRules, invoiceCash, KIND_LABEL, matchDeposits, medianDaysToPay, monthly, outByKind,
  type BankTxn, type FlowMonth, type InvoiceCash, type InvoiceLite,
} from './bank-math'
import { todayISO } from './today'

// 👉 Cash flow (/invoices/cash-flow) and the Dashboard's cash panel: the company bank account beside what was
// invoiced. Rows come from supabase/bank.sql (filled by scripts/bank-statements.mjs). Everything is worked out
// HERE, on the real figures, and only the finished picture is disguised while amounts are hidden — the matching
// compares amounts to the cent, which a disguised copy could not do reliably.

export type TxnView = {
  id: number
  date: string
  amount: number
  balance: number | null
  party: string | null
  note: string | null
  type: string
  kind: string
  kindLabel: string
  kindSet: boolean // the owner chose the kind for this line
  kindRule: boolean // the kind comes from a payee rule ("every payment to this payee")
  invoices: { id: number; no: string }[]
  linkSet: boolean // the owner chose the invoices (or "not an invoice")
}

export type CashFlow =
  | { ready: false }
  | {
      ready: true
      demo: boolean
      empty: boolean
      from: string // first statement day
      to: string // last statement day
      balance: number | null // closing balance of the latest statement
      gaps: string[] // months with no statement (YYYY-MM)
      months: FlowMonth[]
      invoices: InvoiceCash[] // since the first statement
      toConfirm: InvoiceCash[] // the bank shows them paid, the app doesn't (or has no payment date)
      waiting: (InvoiceCash & { remaining: number; age: number })[] // no money yet, or only part — oldest first
      owed: { rm: number; count: number; foreign: number } // what `waiting` still owes in RM, over `count` RM invoices (+ how many foreign-currency ones)
      untracked: number // invoices with payment tracking off and no money seen in the bank — never in `owed`
      markedOnly: InvoiceCash[] // ticked paid in the app, no deposit found
      unmatched: TxnView[] // client deposits not linked to any invoice
      txns: TxnView[] // every line, newest first
      openInvoices: { id: number; no: string; client: string; date: string; amount: number; currency: string }[] // for the link picker
      median: number | null // days from invoice to money in the bank, invoices dated in the period
      year: string
      period: { from: string; to: string; covered: boolean } // the filter's dates, clipped to the statements; covered = a statement overlaps them
      periodBalance: { amount: number; on: string } | null // closing balance of the last statement ending in the period
      chart: FlowMonth[] // the months of the period
      totals: { invoiced: number; clientIn: number; cashIn: number; out: number; net: number } // over the period; net = all money in − all money out
      outKinds: ReturnType<typeof outByKind> // over the period
    }

const num = (v: unknown) => (v == null ? null : Number(v))

async function readAll<T>(table: string, order: string): Promise<T[] | null> {
  const all: T[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order, { ascending: true }).range(from, from + 999)
    if (error) return null // the table does not exist until supabase/bank.sql has been run once
    all.push(...(data as T[]))
    if (data.length < 1000) break
  }
  return all
}

export function toInvoiceLite(rows: Rec[]): InvoiceLite[] {
  const links = quoteLinks(rows)
  const byId = new Map(rows.map(r => [r.id, r]))
  return rows
    .filter(r => r.category === 'cash_in' && r.meta?.invoice_no)
    .map(r => {
      const q = links.get(r.id)
      return {
        id: r.id,
        no: String(r.meta.invoice_no),
        date: String(r.meta?.invoice_date || r.created_at).slice(0, 10),
        client: String(r.meta?.customer || ''),
        amount: Number(r.amount || 0),
        currency: String(r.meta?.currency || 'MYR'),
        paid: isPaid(r),
        issued: isIssued(r),
        quote: q ? String(byId.get(q)?.meta?.invoice_no ?? '') || null : r.meta?.quotation_no ? String(r.meta.quotation_no) : null,
        paidOn: r.meta?.paid_on ? String(r.meta.paid_on).slice(0, 10) : null,
      }
    })
}

/** `period` = the filter's dates (inclusive). Left out it means this calendar year — the Dashboard panel. */
export async function readCashFlow(period?: { from: string; to: string }): Promise<CashFlow> {
  if (await demoMode()) return emptyView(true)
  if (!supabaseConfigured) return { ready: false }
  const [st, tx, recs, rules] = await Promise.all([
    readAll<Record<string, any>>('bank_statement', 'period_to'),
    readAll<Record<string, any>>('bank_txn', 'txn_date'),
    supabase.from('records').select('*').in('category', ['cash_in', 'doc']).limit(5000),
    readPayeeRules(),
  ])
  if (!st || !tx) return { ready: false }
  const view = build(
    st.map(s => ({ from: String(s.period_from), to: String(s.period_to), closing: num(s.closing) })),
    tx.map(toTxn),
    toInvoiceLite(((recs.data ?? []) as Rec[]).map(r => ({ ...r, meta: r.meta ?? {} }))),
    todayISO(),
    period,
    rules,
  )
  return (await moneyHidden()) ? disguise(view, await moneyFactor()) : view
}

// Payee rules live in one records row (doc / setting / 'bank-kinds', meta.rules) — like the /hello settings, no new
// table, and the payee names stay out of the public repo. Written by setTxnKind (lib/bank-actions.ts).
export async function payeeRulesRow(): Promise<{ id: number; meta: { rules?: PayeeRules } } | null> {
  const { data, error } = await supabase.from('records').select('id, meta').eq('category', 'doc').eq('status', 'setting').eq('title', 'bank-kinds').order('id', { ascending: true }).limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0] as { id: number; meta: { rules?: PayeeRules } }) ?? null
}
/** `strict` (actions that write a paid status) throws when the rules can't be read; the page falls back to none. */
export async function readPayeeRules(strict = false): Promise<PayeeRules> {
  try {
    const r = await payeeRulesRow()
    const rules = r?.meta?.rules
    return rules && typeof rules === 'object' ? rules : {}
  } catch (e) {
    if (strict) throw e
    return {}
  }
}

export function toTxn(r: Record<string, any>): BankTxn {
  return {
    id: Number(r.id), account: String(r.account), statement: String(r.statement).slice(0, 10), seq: Number(r.seq),
    txn_date: String(r.txn_date).slice(0, 10), amount: Number(r.amount), balance: num(r.balance),
    type: String(r.type ?? ''), party: r.party ?? null, note: r.note ?? null, description: String(r.description ?? ''),
    kind: r.kind ?? null, invoice_ids: Array.isArray(r.invoice_ids) ? r.invoice_ids.map(Number) : null,
  }
}

function emptyView(demo: boolean): CashFlow {
  return { ready: true, demo, empty: true, from: '', to: '', balance: null, gaps: [], months: [], invoices: [], toConfirm: [], waiting: [], owed: { rm: 0, count: 0, foreign: 0 }, untracked: 0, markedOnly: [], unmatched: [], txns: [], openInvoices: [], median: null, year: todayISO().slice(0, 4), period: { from: '', to: '', covered: false }, periodBalance: null, chart: [], totals: { invoiced: 0, clientIn: 0, cashIn: 0, out: 0, net: 0 }, outKinds: [] }
}

type Lite = InvoiceLite & { paidOn?: string | null }

export function build(
  statements: { from: string; to: string; closing: number | null }[],
  rawTxns: BankTxn[],
  invoices: Lite[],
  today: string,
  range: { from: string; to: string } = { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }, // default: this calendar year
  rules: PayeeRules = {},
): CashFlow {
  if (!statements.length) return emptyView(false)
  const txns = applyPayeeRules(rawTxns, rules) // a line's own kind wins; otherwise its payee's rule
  const sorted = [...statements].sort((a, b) => a.to.localeCompare(b.to))
  const from = sorted[0].from, to = sorted[sorted.length - 1].to
  const covered = coverage(sorted)
  const { byTxn, byInvoice } = matchDeposits(txns, invoices)
  const noOf = new Map(invoices.map(i => [i.id, i.no]))
  const view = (t: BankTxn & { ruled?: boolean }): TxnView => {
    const kind = flowKind(t)
    return {
      id: t.id, date: t.txn_date, amount: t.amount, balance: t.balance, party: t.party, note: t.note, type: t.type,
      kind, kindLabel: KIND_LABEL[kind], kindSet: !!t.kind && t.kind in KIND_LABEL && !t.ruled, kindRule: !!t.ruled,
      invoices: (byTxn.get(t.id) ?? []).map(m => ({ id: m.invoiceId, no: noOf.get(m.invoiceId) ?? '' })),
      linkSet: Array.isArray(t.invoice_ids),
    }
  }
  const all = [...txns].sort((a, b) => b.txn_date.localeCompare(a.txn_date) || b.statement.localeCompare(a.statement) || b.seq - a.seq).map(view)
  const firstMonth = from.slice(0, 7)
  const months = monthly(txns, invoices, covered).filter(m => m.month >= firstMonth && m.month <= today.slice(0, 7))
  const gaps = months.filter(m => !covered(m.month) && m.month < to.slice(0, 7)).map(m => m.month)
  const list = invoiceCash(invoices.filter(i => i.date >= shiftDays(from, -60)), byInvoice, from)
  const paidOnOf = new Map(invoices.map(i => [i.id, i.paidOn ?? null]))
  const toConfirm = list.filter(i => i.state === 'paid-bank' && (!i.paid || !paidOnOf.get(i.id)))
  // Waiting: no deposit and not marked paid, or part-paid. A tracking-off ("issued") invoice is never owed
  // (lib/records.ts isIssued) — it is only counted in `untracked`, until the owner tracks it or links a deposit.
  // Foreign-currency invoices are listed but never added into the RM figure.
  const open = list.filter(i => i.state === 'unpaid' || i.state === 'part')
  const untracked = open.filter(i => i.issued).length
  const waiting = open
    .filter(i => !i.issued)
    .map(i => ({ ...i, remaining: r2(Math.max(0, i.amount - (i.currency === 'MYR' ? i.bank?.received ?? 0 : 0))), age: dayDiff(i.date, today) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const owed = {
    rm: r2(waiting.filter(i => i.currency === 'MYR').reduce((s, i) => s + i.remaining, 0)),
    count: waiting.filter(i => i.currency === 'MYR').length,
    foreign: waiting.filter(i => i.currency !== 'MYR').length,
  }
  const year = today.slice(0, 4)
  // The period: the filter's dates, never before the first statement (nothing is known about the bank before it).
  // A period wholly before the statements (or after the last one) has no bank figures: `covered` false, never zeros.
  const periodCovered = sorted.some(s => s.to >= range.from && s.from <= range.to)
  const pFrom = range.from < from && periodCovered ? from : range.from
  const pTo = range.to
  const inP = (d: string) => d >= pFrom && d <= pTo
  const inPeriod = txns.filter(t => inP(t.txn_date))
  const cashInP = r2(inPeriod.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))
  const outP = r2(inPeriod.filter(t => t.amount < 0).reduce((s, t) => s - t.amount, 0))
  const totals = {
    invoiced: r2(invoices.filter(i => i.currency === 'MYR' && inP(i.date)).reduce((s, i) => s + i.amount, 0)),
    clientIn: r2(inPeriod.filter(t => t.amount > 0 && flowKind(t) === 'client').reduce((s, t) => s + t.amount, 0)),
    cashIn: cashInP,
    out: outP,
    net: r2(cashInP - outP),
  }
  const lastSt = [...sorted].reverse().find(s => s.to <= pTo && s.closing != null)
  const periodBalance = lastSt && lastSt.to >= pFrom ? { amount: lastSt.closing as number, on: lastSt.to } : null
  const chart = months.filter(m => m.month >= pFrom.slice(0, 7) && m.month <= pTo.slice(0, 7))
  const settledIds = new Set([...byInvoice.values()].filter(s => s.full).map(s => s.invoiceId))
  const openInvoices = invoices
    .filter(i => !i.paid && !settledIds.has(i.id) && i.date >= shiftDays(from, -60))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ id, no, client, date, amount, currency }) => ({ id, no, client, date, amount, currency }))
  return {
    ready: true, demo: false, empty: txns.length === 0, from, to,
    balance: sorted[sorted.length - 1].closing,
    gaps, months, invoices: list, toConfirm, waiting, owed, untracked, markedOnly: list.filter(i => i.state === 'marked-only'),
    unmatched: all.filter(t => t.amount > 0 && t.kind === 'client' && !t.invoices.length && !t.linkSet),
    txns: all, openInvoices, median: medianDaysToPay(list.filter(i => inP(i.date))), year,
    period: { from: pFrom, to: pTo, covered: periodCovered }, periodBalance, chart, totals, outKinds: outByKind(inPeriod),
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
function shiftDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// The finished picture with every amount multiplied by this request's factor and money in free text blanked.
// Counts, dates, names, shares and day counts stay true.
function disguise(v: CashFlow, k: number): CashFlow {
  if (!v.ready) return v
  const x = (n: number) => n * k
  const xn = (n: number | null) => (n == null ? null : n * k)
  const inv = (i: InvoiceCash): InvoiceCash => ({ ...i, amount: x(i.amount), bank: i.bank ? { ...i.bank, received: x(i.bank.received) } : null })
  const month = (m: FlowMonth): FlowMonth => ({ ...m, invoiced: x(m.invoiced), cashIn: x(m.cashIn), clientIn: x(m.clientIn), out: x(m.out), net: x(m.net), closing: xn(m.closing) })
  const t = (r: TxnView): TxnView => ({ ...r, amount: x(r.amount), balance: xn(r.balance), note: r.note ? scrubAmounts(r.note) : r.note })
  return {
    ...v,
    balance: xn(v.balance),
    months: v.months.map(month),
    chart: v.chart.map(month),
    periodBalance: v.periodBalance ? { ...v.periodBalance, amount: x(v.periodBalance.amount) } : null,
    invoices: v.invoices.map(inv),
    toConfirm: v.toConfirm.map(inv),
    waiting: v.waiting.map(i => ({ ...inv(i), remaining: x(i.remaining), age: i.age })),
    owed: { ...v.owed, rm: x(v.owed.rm) },
    markedOnly: v.markedOnly.map(inv),
    unmatched: v.unmatched.map(t),
    txns: v.txns.map(t),
    openInvoices: v.openInvoices.map(o => ({ ...o, amount: x(o.amount) })),
    totals: { invoiced: x(v.totals.invoiced), clientIn: x(v.totals.clientIn), cashIn: x(v.totals.cashIn), out: x(v.totals.out), net: x(v.totals.net) },
    outKinds: v.outKinds.map(o => ({ ...o, total: x(o.total) })),
  }
}
