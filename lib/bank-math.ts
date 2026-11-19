// Cash flow from the company bank account (Hong Leong current account), next to what was invoiced.
// Pure maths — no database, no React — so tests/bank.test.mjs can run it. Rows come from the `bank_txn` table
// (supabase/bank.sql), filled by scripts/bank-statements.mjs from the statements the accountant keeps in Drive.
//
// Two different things, never mixed:
//   • Revenue  = what was INVOICED, on the invoice date (lib/invoices.ts).
//   • Cash in  = what LANDED in the bank, on the day it landed (this file).
// The gap between them is money still on its way — or invoices nobody paid.

export type BankTxn = {
  id: number
  account: string
  statement: string // YYYY-MM-DD, last day of the statement the line is on
  seq: number
  txn_date: string // YYYY-MM-DD
  amount: number // + money in, − money out (RM)
  balance: number | null // printed only on the last line of a day
  type: string // the bank's wording: "Cr Adv-Interbank GIRO at KLM", "Fund Transfer at DIO", …
  party: string | null // payer / payee name as the bank printed it
  note: string | null // the payer's own reference ("INV SYCP-202610-003 MD Payment")
  description: string
  kind?: string | null // owner's override of flowKind (set on the Cash flow page)
  invoice_ids?: number[] | null // owner's override of the match: these invoices, or [] for "not an invoice"
}

export type InvoiceLite = {
  id: number
  no: string
  date: string // invoice date
  client: string
  amount: number
  currency: string
  paid: boolean // marked paid in the app
  issued: boolean // documented only, payment not tracked
  quote?: string | null // the quotation it came from (meta.quotation_no), which some payers quote instead
}

// ── What kind of money is it? ───────────────────────────────────────────────────────────────────────────────
export const IN_KINDS = { client: 'Client payment', owner: 'From director', interest: 'Interest', refund: 'Refund', other_in: 'Other in' } as const
export const OUT_KINDS = {
  salary: 'Salary', claims: 'Claims & reimbursements', statutory: 'EPF / SOCSO / tax', professional: 'Accountant, audit & secretary',
  bank: 'Bank charges', rent: 'Rent & utilities', supplier: 'Crew & suppliers', other_out: 'Other out',
} as const
export type FlowKind = keyof typeof IN_KINDS | keyof typeof OUT_KINDS

// Payee rules ("every payment to this payee is rent"), one per direction: "out:<PAYEE>" / "in:<PAYEE>" → a kind of
// that direction. The payee names live only in Supabase (a records setting row, lib/bank.ts) — never in this public repo.
export const payeeKey = (party: string | null | undefined) => (party ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
export const ruleKey = (t: { amount: number; party: string | null }) => `${t.amount < 0 ? 'out' : 'in'}:${payeeKey(t.party)}`
export type PayeeRules = Record<string, string>

/** Lines with no kind of their own take their payee's rule; `ruled` says the kind came from a rule. */
export function applyPayeeRules<T extends { amount: number; party: string | null; kind?: string | null }>(txns: T[], rules: PayeeRules): (T & { ruled?: boolean })[] {
  return txns.map(t => {
    if (t.kind || !payeeKey(t.party)) return t
    const k = rules[ruleKey(t)]
    return k && Object.hasOwn(t.amount < 0 ? OUT_KINDS : IN_KINDS, k) ? { ...t, kind: k, ruled: true } : t
  })
}

export const KIND_LABEL: Record<string, string> = { ...IN_KINDS, ...OUT_KINDS }

// The director's name as the bank prints it — transfers to/from him are salary, claims or capital, not trade.
const DIRECTOR = /WONG SENG YUE|AEREON WONG/i

// Order matters: the most specific wording first.
export function flowKind(t: Pick<BankTxn, 'amount' | 'type' | 'party' | 'note' | 'description'> & { kind?: string | null }): FlowKind {
  if (t.kind && t.kind in KIND_LABEL) return t.kind as FlowKind
  const all = `${t.type} ${t.party ?? ''} ${t.note ?? ''} ${t.description}`
  if (t.amount >= 0) {
    if (/^Interest\b/i.test(t.type)) return 'interest'
    if (DIRECTOR.test(t.party ?? '') ) return 'owner'
    if (/refund|reversal/i.test(all)) return 'refund'
    return 'client'
  }
  if (/Serv(ice)? Charge|Stamp Duty|Cheque Book|Annual Fee/i.test(t.type)) return 'bank'
  if (/SOCSO|PERKESO|KESELAMATAN SOSIAL|KWSP|KUMPULAN WANG SIMPANAN|EPF|LHDN|HASIL|EIS\b|PCB/i.test(all)) return 'statutory'
  if (/AUDIT|ACCOUNT|SECRETAR|CAC\b|\bstat\b/i.test(all)) return 'professional'
  if (/TENAGA|TNB|AIR SELANGOR|UNIFI|TM NET|MAXIS|CELCOM|DIGI|rental|rent\b/i.test(all) && !/equip/i.test(all)) return 'rent'
  if (DIRECTOR.test(t.party ?? '')) return /salary|bonus/i.test(all) ? 'salary' : 'claims'
  return 'supplier'
}

// ── Matching deposits to invoices ───────────────────────────────────────────────────────────────────────────
// An invoice number written however a payer types it: "SYCP-202610-003", "SYCP202610003", "SYCP 202501 004",
// "S Y C P - 2 0 2 6 0 1 - 0 0 …" (SWIFT), and the old "SYCP-2023-17" style. All squash to "SYCP202610003".
export const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

// Invoice and quotation numbers a deposit's text mentions, squashed. Only full numbers count — a cut-off one
// ("S Y C P - 2 0 2 6 0 1 - 0 0", SWIFT's 35-character limit) matches nothing.
//   SYCP-202610-003, SYCP202610003, SYCP 202501 004, SYCP-202604-009A   → SYCP202610003 …
//   SYCP-2023-17, SYCP-2023- 91, SYCP202399 (the 2022–23 numbering)      → SYCP202317 …
//   INV 202512 005, 50PCT 202608 021 (number without the prefix)          → SYCP202512005 …
//   SYCP-Q-202510-03 (the payer quoted the quotation)                     → SYCPQ20251003
export function refsIn(text: string): string[] {
  const t = text.toUpperCase()
  const out = new Set<string>()
  for (const m of t.matchAll(/SYCP\W*Q\W*(20\d\d)\W*(\d\d)\W*(\d{2,3})(?!\d)/g)) out.add(`SYCPQ${m[1]}${m[2]}${m[3]}`)
  for (const m of t.matchAll(/SYCP(?!\W*Q)\W*(20\d\d)\W*(\d\d)\W*(\d{3})(?:([A-Z])(?![A-Z]))?(?!\d)/g)) out.add(`SYCP${m[1]}${m[2]}${m[3]}${m[4] ?? ''}`)
  for (const m of t.matchAll(/SYCP\W*(202[23])\W*(\d{1,2})(?!\d)/g)) out.add(`SYCP${m[1]}${m[2]}`)
  for (const m of t.matchAll(/(?:^|[^A-Z0-9-]|INV|PCT)\W*(20\d\d)[\s-]?(0[1-9]|1[0-2])[\s-]+(\d{3})(?!\d)/g)) out.add(`SYCP${m[1]}${m[2]}${m[3]}`)
  return [...out]
}

const STOP = new Set(['SDN', 'BHD', 'BERHAD', 'SENDIRIAN', 'PTE', 'LTD', 'LIMITED', 'THE', 'AND', 'OF', 'M', 'MALAYSIA', 'MY', 'CO', 'PLT', 'INC', 'GROUP', 'ASIA', 'GLOBAL', 'INTERNATIONAL', 'MARKETING', 'COMMUNICATIONS', 'SERVICES', 'SOLUTIONS', 'TRADING', 'ENTERPRISE', 'HOLDINGS', 'MEDIA', 'FKA'])
const words = (s: string) => squashWords(s).filter(w => w.length > 2 && !STOP.has(w))
const squashWords = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)

// Does the bank's payer name look like the invoice's client? A shared distinctive word is enough
// ("FUSION WORKS SDN. BHD." ~ "Fusion Works"); banks cut names at ~30 characters, so a prefix counts too.
export function sameParty(payer: string | null, client: string): boolean {
  if (!payer) return false
  const a = words(payer), b = words(client)
  if (!a.length || !b.length) return false
  return a.some(x => b.some(y => x === y || (x.length >= 4 && y.startsWith(x)) || (y.length >= 4 && x.startsWith(y))))
}

export type Match = { invoiceId: number; how: 'reference' | 'name+amount' | 'owner' }
export type Settled = {
  invoiceId: number
  received: number // RM landed against this invoice
  lastPaid: string // date of the last deposit counted
  full: boolean // received covers the invoice (RM invoices), or any payment for a foreign-currency one
  how: Match['how']
  txnIds: number[]
}

const DAY = 86400000
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY)
const near = (a: number, b: number) => Math.abs(a - b) < 0.01

// Link every client deposit to the invoice(s) it pays. Rules, strongest first:
//   1. the owner picked the invoices on the Cash flow page (txn.invoice_ids) — always wins; [] = "not an invoice";
//   2. the deposit's reference names an invoice number;
//   3. the payer looks like the client AND the amount is the invoice's full amount, or exactly what is still
//      owed on it, paid between 14 days before and a year after the invoice date. Several candidates → the oldest
//      unpaid one. Only RM invoices — a foreign-currency invoice lands as some other RM figure.
// A deposit with no match stays "unmatched" for the owner to look at. Nothing here writes anything.
export function matchDeposits(txns: BankTxn[], invoices: InvoiceLite[]): { byTxn: Map<number, Match[]>; byInvoice: Map<number, Settled> } {
  // A few old numbers were used twice (2023); a number can also be a quotation's. Several invoices under one
  // number → the one whose client looks like the payer, else none (left for the owner).
  const byNo = new Map<string, InvoiceLite[]>()
  for (const i of invoices) for (const k of [squash(i.no), i.quote ? squash(i.quote) : '']) if (k) byNo.set(k, [...(byNo.get(k) ?? []), i])
  const lookup = (ref: string, t: BankTxn) => {
    const list = byNo.get(ref) ?? []
    if (list.length <= 1) return list[0]
    const same = list.filter(i => sameParty(`${t.party ?? ''} ${t.note ?? ''}`, i.client))
    return same.length === 1 ? same[0] : undefined
  }
  const byId = new Map(invoices.map(i => [i.id, i]))
  const byTxn = new Map<number, Match[]>()
  const got = new Map<number, Settled>()
  const PART = /DEPOSIT|BALANCE|\d+\s*%|\d+\s*PCT|PARTIAL|INSTAL/i
  // A foreign-currency invoice can't be compared with the RM that landed, so one deposit counts as paid in full —
  // unless any of its deposits says deposit / balance / %, which leaves it part-paid for the owner to confirm.
  const partSeen = new Set<number>()
  const credit = (inv: InvoiceLite, t: BankTxn, amount: number, how: Match['how']) => {
    const s = got.get(inv.id) ?? { invoiceId: inv.id, received: 0, lastPaid: t.txn_date, full: false, how, txnIds: [] }
    s.received = Math.round((s.received + amount) * 100) / 100
    if (t.txn_date > s.lastPaid) s.lastPaid = t.txn_date
    s.txnIds.push(t.id)
    if (PART.test(t.note ?? '')) partSeen.add(inv.id)
    s.full = inv.currency !== 'MYR' ? !partSeen.has(inv.id) : s.received >= inv.amount - 0.5
    got.set(inv.id, s)
    byTxn.set(t.id, [...(byTxn.get(t.id) ?? []), { invoiceId: inv.id, how }])
  }
  // A deposit naming several invoices (or picked for several) is spread over them in invoice order.
  const spread = (t: BankTxn, list: InvoiceLite[], how: Match['how']) => {
    let left = t.amount
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    sorted.forEach((inv, k) => {
      const owed = inv.currency === 'MYR' ? Math.max(0, inv.amount - (got.get(inv.id)?.received ?? 0)) : left
      const take = k === sorted.length - 1 ? left : Math.min(left, owed)
      credit(inv, t, take, how)
      left = Math.round((left - take) * 100) / 100
    })
  }
  const deposits = txns.filter(t => t.amount > 0 && flowKind(t) === 'client').sort((a, b) => a.txn_date.localeCompare(b.txn_date) || a.seq - b.seq)
  const rest: BankTxn[] = []
  for (const t of deposits) {
    if (Array.isArray(t.invoice_ids)) {
      const list = t.invoice_ids.map(id => byId.get(id)).filter((i): i is InvoiceLite => !!i)
      if (list.length) spread(t, list, 'owner')
      else byTxn.set(t.id, []) // owner said: not an invoice payment
      continue
    }
    const named = [...new Set(refsIn(`${t.note ?? ''} ${t.description}`).map(r => lookup(r, t)).filter((i): i is InvoiceLite => !!i))]
    if (named.length) spread(t, named, 'reference')
    else rest.push(t)
  }
  // Payer ≈ client. The bank's payer can be an agency or payment platform paying for the client, which then
  // usually names the client in its note ("COMMERCE DOTASIA … Xamble Creators") — so the note counts too.
  const owedOn = (i: InvoiceLite) => i.amount - (got.get(i.id)?.received ?? 0)
  const window = (i: InvoiceLite, t: BankTxn) => days(i.date, t.txn_date) >= -14 && days(i.date, t.txn_date) <= 365
  for (const t of rest) {
    const who = `${t.party ?? ''} ${t.note ?? ''}`
    const mine = invoices.filter(i => i.currency === 'MYR' && sameParty(who, i.client) && window(i, t) && owedOn(i) > 0.5)
      .sort((a, b) => a.date.localeCompare(b.date))
    const exact = mine.find(i => near(t.amount, i.amount) || near(t.amount, owedOn(i)))
    if (exact) { credit(exact, t, t.amount, 'name+amount'); continue }
    // a deposit / balance payment: says so, smaller than what is owed, and only one open invoice for that client
    if (PART.test(t.note ?? '') && mine.length === 1 && t.amount < owedOn(mine[0]) + 0.5) credit(mine[0], t, t.amount, 'name+amount')
  }
  return { byTxn, byInvoice: got }
}

// ── The picture ─────────────────────────────────────────────────────────────────────────────────────────────
// bank: 'full' = statements cover every day; 'part' = some days only (figures are partial); 'none' = no statement.
export type FlowMonth = { month: string; invoiced: number; cashIn: number; clientIn: number; out: number; net: number; closing: number | null; bank: 'full' | 'part' | 'none' }

// Month by month: invoiced (RM invoices, by invoice date) beside money in / out of the bank and the balance at
// month end. A month the statements don't cover has closing = null and no bank figures (not zero).
export function monthly(txns: BankTxn[], invoices: InvoiceLite[], covered: (month: string) => boolean): FlowMonth[] {
  const map = new Map<string, FlowMonth>()
  const get = (m: string) => map.get(m) ?? (map.set(m, { month: m, invoiced: 0, cashIn: 0, clientIn: 0, out: 0, net: 0, closing: null, bank: 'none' }), map.get(m)!)
  for (const i of invoices) if (i.currency === 'MYR') get(i.date.slice(0, 7)).invoiced += i.amount
  const sorted = [...txns].sort((a, b) => a.txn_date.localeCompare(b.txn_date) || a.statement.localeCompare(b.statement) || a.seq - b.seq)
  for (const t of sorted) {
    const m = get(t.txn_date.slice(0, 7))
    if (t.amount > 0) { m.cashIn += t.amount; if (flowKind(t) === 'client') m.clientIn += t.amount }
    else m.out += -t.amount
    if (t.balance != null) m.closing = t.balance
  }
  const months = [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
  let last: number | null = null
  for (const m of months) {
    for (const k of ['invoiced', 'cashIn', 'clientIn', 'out'] as const) m[k] = Math.round(m[k] * 100) / 100
    m.net = Math.round((m.cashIn - m.out) * 100) / 100
    if (!covered(m.month)) { m.bank = m.cashIn || m.out ? 'part' : 'none'; m.closing = null; last = null; continue }
    m.bank = 'full'
    if (m.closing == null) m.closing = last // a quiet month keeps last month's balance
    last = m.closing
  }
  return months
}

// Which months the statements cover, from each statement's period ([from, to] inclusive). A month counts only
// when every day of it is inside some statement.
export function coverage(periods: { from: string; to: string }[]): (month: string) => boolean {
  const days = new Set<string>()
  for (const p of periods) for (let d = Date.parse(p.from); d <= Date.parse(p.to); d += DAY) days.add(new Date(d).toISOString().slice(0, 10))
  return (month: string) => {
    const [y, m] = month.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    for (let d = 1; d <= last; d++) if (!days.has(`${month}-${String(d).padStart(2, '0')}`)) return false
    return true
  }
}

export type InvoiceCash = InvoiceLite & { bank: Settled | null; state: 'paid-bank' | 'part' | 'marked-only' | 'unpaid' | 'before-bank'; daysToPay: number | null }

// Every invoice with what the bank says about it.
//   paid-bank   — the deposits cover it
//   part        — some money landed, not all (a deposit invoice's first half, a short payment)
//   marked-only — ticked paid in the app, but no matching deposit (paid elsewhere, cash, or the match was missed)
//   unpaid      — no deposit yet and not marked paid
//   before-bank — dated before the first statement: the bank can't say either way
export function invoiceCash(invoices: InvoiceLite[], byInvoice: Map<number, Settled>, bankFrom: string): InvoiceCash[] {
  return invoices.map(i => {
    const bank = byInvoice.get(i.id) ?? null
    const state: InvoiceCash['state'] = bank ? (bank.full ? 'paid-bank' : 'part') : i.paid ? 'marked-only' : i.date < bankFrom ? 'before-bank' : 'unpaid'
    return { ...i, bank, state, daysToPay: bank?.full ? Math.max(0, days(i.date, bank.lastPaid)) : null }
  }).sort((a, b) => b.date.localeCompare(a.date))
}

// Median days from invoice date to the money landing, over invoices the bank shows fully paid.
export function medianDaysToPay(list: InvoiceCash[]): number | null {
  const d = list.map(i => i.daysToPay).filter((n): n is number => n != null).sort((a, b) => a - b)
  if (!d.length) return null
  const mid = Math.floor(d.length / 2)
  return d.length % 2 ? d[mid] : Math.round((d[mid - 1] + d[mid]) / 2)
}

// Money out of the bank by kind, over a set of rows.
export function outByKind(txns: BankTxn[]): { kind: FlowKind; label: string; total: number; count: number }[] {
  const map = new Map<FlowKind, { total: number; count: number }>()
  for (const t of txns) if (t.amount < 0) {
    const k = flowKind(t); const v = map.get(k) ?? { total: 0, count: 0 }
    v.total += -t.amount; v.count++; map.set(k, v)
  }
  return [...map].map(([kind, v]) => ({ kind, label: KIND_LABEL[kind], total: Math.round(v.total * 100) / 100, count: v.count })).sort((a, b) => b.total - a.total)
}
