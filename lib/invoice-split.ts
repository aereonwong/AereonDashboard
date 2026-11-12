// 👉 Deposit + balance invoices (a client that wants each payment on its own
// invoice — Sime Darby, Nov 2026; AirAsia MOVE / Super Creator, Nov 2026).
// Rules: .claude/skills/raise-invoice/SKILL.md, "Deposit + balance as two invoices".
//
// Each invoice's TOTAL is only what that invoice asks for, never the full
// contract, and the two rows add up to the contract. The deposit row carries
//   meta.split = { part: 'deposit', percent, contract_value, deposit_invoice,
//                  balance_invoice: null, terms_locator?, printed? }
// and this file turns it into the balance invoice: the same Canva design copied,
// with the number, date, QTY %, amounts and the two split lines rewritten.
//
// Copying the DEPOSIT design (not the template) keeps whatever was fixed by hand
// on it — wording, spacing, a missing venue line — so the pair always match.
//
// Pure — no database, no Canva — so the money maths is unit-tested
// (tests/invoice-split.test.mjs).

export type Split = {
  part: 'deposit' | 'balance'
  /** The DEPOSIT's share of the contract, in whole percent (30 → 30%). */
  percent: number
  contract_value: number
  deposit_invoice: string
  balance_invoice: string | null
  /** The Canva element holding the Payment Terms (template: the description box). */
  terms_locator?: string
  /** The split lines exactly as the deposit invoice prints them, so the balance
   *  can find and rewrite them. */
  printed?: { deposit?: string; balance?: string }
}

type Row = { id?: number; category?: string | null; amount?: number | null; status?: string | null; meta?: Record<string, any> | null }

export const money = (n: number, cur = 'MYR') =>
  `${cur} ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const round2 = (n: number) => Math.round(n * 100) / 100

/** DD/MM/YY, as printed on every invoice. */
export const stamp = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export function splitOf(r: Row): Split | null {
  const s = r.meta?.split
  return s && typeof s === 'object' && (s.part === 'deposit' || s.part === 'balance') ? (s as Split) : null
}

/** Why a balance invoice can't be raised from this row, or null when it can. */
export function balanceBlock(r: Row): string | null {
  const s = splitOf(r)
  if (!s || s.part !== 'deposit') return 'Not a deposit invoice'
  if (s.balance_invoice) return `Balance already raised: ${s.balance_invoice}`
  if (r.category !== 'cash_in') return 'Not an invoice'
  if (!(r.meta?.canva_design || r.meta?.render?.design_id)) return 'No Canva design linked to copy'
  if (!(s.percent > 0 && s.percent < 100)) return 'The deposit percent is missing'
  if (!(Number(s.contract_value) > Number(r.amount ?? 0))) return 'The contract value is missing'
  if (r.meta?.discount) return 'The deposit carries a discount — raise its balance by hand'
  if (!s.printed?.deposit || !s.printed?.balance)
    return 'The deposit invoice has no recorded split lines to rewrite — raise the balance by hand once'
  return null
}

/** The balance's own figures, from the deposit row. */
export function balanceFigures(r: Row) {
  const s = splitOf(r)!
  const deposit = round2(Number(r.amount ?? 0))
  const contract = round2(Number(s.contract_value))
  return {
    percent: 100 - s.percent,
    depositPercent: s.percent,
    deposit,
    contract,
    amount: round2(contract - deposit),
    currency: String(r.meta?.currency ?? 'MYR'),
  }
}

/** The lines a deposit invoice prints under Payment Terms. Raising a deposit
 *  by hand should print exactly these and record them in meta.split.printed. */
export function depositLines(contract: number, percent: number, cur = 'MYR', balanceDue?: string) {
  const dep = round2((contract * percent) / 100)
  return {
    contract: `Contract value: ${money(contract, cur)}`,
    deposit: `Deposit ${percent}%: ${money(dep, cur)} (payable on this invoice)`,
    balance: `Balance ${100 - percent}%: ${money(round2(contract - dep), cur)} (billed on a separate invoice${balanceDue ? `, due by ${balanceDue}` : ''})`,
  }
}

/** The two lines that replace the deposit's split lines on the balance invoice. */
export function balanceLines(r: Row) {
  const s = splitOf(r)!
  const f = balanceFigures(r)
  const paid = r.status === 'paid'
  const on = r.meta?.paid_on ? ` on ${stamp(String(r.meta.paid_on))}` : ''
  return {
    deposit: paid
      ? `Less deposit paid (${s.deposit_invoice})${on}: ${money(f.deposit, f.currency)}`
      : `Less deposit (${s.deposit_invoice}): ${money(f.deposit, f.currency)}`,
    balance: `Balance due ${f.percent}%: ${money(f.amount, f.currency)} (payable on this invoice)`,
  }
}

export type Locators = { numberAndDate: string; qty: string; lineAmount: string; subtotal: string; total: string; description: string }

/** The Canva edits that turn a COPY of the deposit design into the balance invoice.
 *  Every edit is a find-and-replace on text the deposit is known to print.
 *  Canva reports a find that matched nothing as applied (tested 12 Nov 2026),
 *  so the drawn result is read back and checked with balanceCheck() too. */
export function balanceOps(r: Row, no: string, date: string, at: Locators) {
  const s = splitOf(r)!
  const f = balanceFigures(r)
  const lines = balanceLines(r)
  const terms = s.terms_locator || at.description
  const swap = (locator_id: string, find_text: string, replace_text: string) => ({
    type: 'find_and_replace_text',
    locator_id,
    find_text,
    replace_text,
  })
  const was = money(f.deposit, f.currency)
  const now = money(f.amount, f.currency)
  return [
    { type: 'update_title', title: `${no} - ${r.meta?.job ?? 'Balance'}` },
    swap(at.numberAndDate, String(r.meta?.invoice_no), no),
    swap(at.numberAndDate, `Date: ${stamp(String(r.meta?.invoice_date))}`, `Date: ${stamp(date)}`),
    swap(at.qty, `${f.depositPercent}%`, `${f.percent}%`),
    swap(at.lineAmount, was, now),
    swap(at.subtotal, was, now),
    swap(at.total, was, now),
    swap(terms, String(s.printed!.deposit), lines.deposit),
    swap(terms, String(s.printed!.balance), lines.balance),
  ]
}

/** What the drawn balance invoice must print, and what must be gone. */
export function balanceCheck(r: Row, no: string, date: string) {
  const s = splitOf(r)!
  const f = balanceFigures(r)
  const lines = balanceLines(r)
  return {
    expect: [`INVOICE No. ${no}`, `Date: ${stamp(date)}`, `${f.percent}%`, money(f.amount, f.currency), lines.deposit, lines.balance],
    forbid: [`INVOICE No. ${r.meta?.invoice_no}`, String(s.printed!.deposit), String(s.printed!.balance)],
  }
}

/** Every piece of text in a Canva edit response, wherever it sits — the MCP
 *  connector says `characters`, Composio's older copy of the tool `text`. */
export function canvaText(doc: unknown): string {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) ((k === 'characters' || k === 'text') && typeof x === 'string' ? out.push(x) : walk(x))
  }
  walk(doc)
  return out.join('')
}

/** Why the drawn result fails the check, or null when it passes. No text at all
 *  fails too — a balance invoice is never filed unverified. */
export function checkDrawn(doc: unknown, check: { expect: string[]; forbid: string[] }): string | null {
  const text = canvaText(doc)
  if (!text) return 'Canva sent back no text to check'
  const missing = check.expect.filter(t => !text.includes(t))
  const left = check.forbid.filter(t => text.includes(t))
  if (!missing.length && !left.length) return null
  return [missing.length ? `missing ${missing.map(t => `"${t}"`).join(', ')}` : '', left.length ? `still printing ${left.map(t => `"${t}"`).join(', ')}` : '']
    .filter(Boolean)
    .join('; ')
}

/** The balance invoice's row, built from the deposit's. Payment, Drive, edit
 *  history and linked posts belong to the deposit and are not carried over. */
export function balanceRow(r: Row, no: string, date: string, design: { id: string; url: string }, now: string) {
  const s = splitOf(r)!
  const f = balanceFigures(r)
  const {
    drive: _d, edits: _e, ig_posts: _i, paid_at: _pa, paid_on: _po, payment_ref: _pr,
    render: _r, canva_design: _cd, canva_url: _cu, split: _s,
    // Worked out on the deposit's figure, so wrong for the balance.
    list_price: _lp, discount: _dc,
    ...keep
  } = r.meta ?? {}
  const job = String(r.meta?.job ?? '')
  const tracked = r.status !== 'issued' && r.meta?.payment_tracked !== false
  return {
    category: 'cash_in',
    status: tracked ? 'waiting' : 'issued',
    amount: f.amount,
    due_date: null as string | null,
    created_at: `${date}T09:00:00+08:00`,
    title: `${no} · ${job} (balance ${f.percent}%)`.slice(0, 80),
    notes: `${job} — balance ${f.percent}% of ${money(f.contract, f.currency)}; deposit on ${s.deposit_invoice}`,
    meta: {
      ...keep,
      invoice_no: no,
      invoice_date: date,
      source: 'dashboard',
      // A real bill, like a dashboard invoice saved as 'waiting' (saveInvoice) —
      // unless the deposit itself is only documented, then so is the balance.
      payment_tracked: tracked,
      canva_design: design.id,
      canva_url: design.url,
      render: { status: 'done', design_id: design.id, rendered_at: now, source: 'dashboard', copied_from: r.meta?.canva_design ?? r.meta?.render?.design_id },
      split: { ...s, part: 'balance', balance_invoice: no },
    } as Record<string, any>,
  }
}
