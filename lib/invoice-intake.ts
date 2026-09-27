import { supabase, supabaseConfigured } from './supabase'
import type { InlineKeyboard } from './telegram'
import type { DocKind } from './invoice-render'

// 👉 The invoice interview. Aereon says /invoice in Telegram, answers eight
// questions, and a real invoice record is filed the moment he confirms.
//
// Two rules this file exists to enforce, both of them lessons from the audit of
// the 2021–2026 back catalogue:
//
//   1. He NEVER types the invoice number. The database issues it as
//      SYCP-YYYYMM-NNN, restarting at 001 each month. Eight duplicate numbers in
//      the old book came from typing them by hand; this makes that impossible.
//   2. A discount is its own field, never buried inside the price. Twenty old
//      invoices wrote "RM 3,500 (DISCOUNT RM500)" into the price cell, which
//      meant nothing could total what had been given away.
//
// The interview state lives in one `doc` row per chat, so an unfinished invoice
// survives a redeploy and there is no extra table to migrate.

export type Currency = 'MYR' | 'USD' | 'SGD' | 'EUR' | 'RMB'

export type Draft = {
  /** Invoice or quotation — same interview, different number series and template. */
  kind: DocKind
  step: Step
  client?: { name: string; contact?: string; address?: string; reg?: string; isNew?: boolean }
  job?: string
  venue?: string
  eventDate?: string // YYYY-MM-DD
  eventTime?: string
  deliverables?: string[]
  amount?: number
  currency?: Currency
  discount?: number
  terms?: string
  quotation?: string
  validityDays?: number
  date?: string // YYYY-MM-DD
  /** Candidate clients from the last search, so a numeric reply can pick one. */
  matches?: { name: string; contact?: string; address?: string; reg?: string }[]
}

export const STEPS = [
  'client',
  'client_details',
  'job',
  'venue',
  'event_date',
  'event_time',
  'deliverables',
  'amount',
  'discount',
  'terms',
  'quotation',
  'validity',
  'date',
  'confirm',
] as const
export type Step = (typeof STEPS)[number]

// The three payment terms that actually appear across the recent invoices.
export const TERMS: Record<string, string> = {
  half: 'A non-refundable deposit of 50% is required to commence the work\nremaining 50% balance is due upon project delivered and signed off',
  ondelivery: 'Full payment is due upon delivery of the content',
  net30: 'Payment to be initiated within 30 days of posting',
}

const CURRENCIES: Currency[] = ['MYR', 'USD', 'SGD', 'EUR', 'RMB']

// ------------------------------------------------------------------ storage

const KEY = 'invoice_intake'

/** The open interview for this chat, or null. */
export async function loadDraft(chatId: number | string): Promise<{ id: number; draft: Draft } | null> {
  if (!supabaseConfigured) return null
  const { data } = await supabase
    .from('records')
    .select('id, meta')
    .eq('category', 'doc')
    .eq('status', KEY)
    .eq('title', `intake:${chatId}`)
    .limit(1)
  const row = data?.[0]
  return row ? { id: row.id, draft: (row.meta?.draft ?? { step: 'client' }) as Draft } : null
}

export async function saveDraft(chatId: number | string, draft: Draft): Promise<void> {
  if (!supabaseConfigured) return
  const existing = await loadDraft(chatId)
  if (existing) {
    await supabase.from('records').update({ meta: { draft } }).eq('id', existing.id)
  } else {
    await supabase.from('records').insert({
      category: 'doc',
      status: KEY,
      title: `intake:${chatId}`,
      amount: 0,
      notes: 'Invoice interview in progress',
      meta: { draft },
    })
  }
}

export async function clearDraft(chatId: number | string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase.from('records').delete().eq('category', 'doc').eq('status', KEY).eq('title', `intake:${chatId}`)
}

// ------------------------------------------------------------- the number 🔢

/**
 * The next invoice number for a given month: SYCP-YYYYMM-NNN, restarting at 001
 * when the month turns. Derived from the highest number already filed in that
 * month, so it stays correct even if invoices are added from elsewhere.
 */
export async function nextInvoiceNo(date: string, kind: DocKind = 'invoice'): Promise<string> {
  const stamp = date.slice(0, 7).replace('-', '') // YYYYMM
  // Quotations keep their own series so an invoice and a quote raised in the
  // same month never share a number.
  const prefix = kind === 'quotation' ? `SYCP-Q-${stamp}-` : `SYCP-${stamp}-`
  if (!supabaseConfigured) return `${prefix}001`
  // Older quotations were numbered with two digits (SYCP-Q-202607-01). We read
  // whatever is there and always WRITE three, so the series standardises itself.
  const { data } = await supabase.from('records').select('meta').limit(3000)
  let top = 0
  for (const r of data ?? []) {
    const no = String((r.meta as any)?.invoice_no ?? '')
    if (!no.startsWith(prefix)) continue
    const n = Number(no.slice(prefix.length))
    if (Number.isFinite(n) && n > top) top = n
  }
  return `${prefix}${String(top + 1).padStart(3, '0')}`
}

// -------------------------------------------------------------- client lookup

type Known = { name: string; contact?: string; address?: string; reg?: string }

/** Clients he has invoiced before, matched loosely on name. Details are gathered
 *  from the client record AND from every earlier invoice, newest last, so an
 *  address typed once is remembered even for clients that pre-date the bot. */
export async function findClients(q: string): Promise<Known[]> {
  if (!supabaseConfigured || q.trim().length < 2) return []
  const needle = q.toLowerCase().trim()
  const [cust, docs] = await Promise.all([
    supabase.from('records').select('title, meta').eq('category', 'customer').limit(1000),
    supabase
      .from('records')
      .select('meta, created_at')
      .in('category', ['cash_in', 'doc'])
      .not('meta->>address', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1000),
  ])
  const byName = new Map<string, Known>()
  const merge = (name: string, m: any) => {
    const key = name.toLowerCase().trim()
    const cur = byName.get(key) ?? { name }
    byName.set(key, {
      name: cur.name,
      contact: m?.contact || cur.contact,
      address: m?.address || cur.address,
      reg: m?.reg || cur.reg,
    })
  }
  for (const r of cust.data ?? []) merge(String(r.title), r.meta)
  for (const r of docs.data ?? []) {
    const name = (r.meta as any)?.customer
    if (name) merge(String(name), r.meta)
  }
  return [...byName.values()].filter(c => c.name.toLowerCase().includes(needle)).slice(0, 6)
}

/** Remember a client so the next invoice needs no retyping. */
async function rememberClient(c: NonNullable<Draft['client']>) {
  const { data } = await supabase.from('records').select('id, meta').eq('category', 'customer').ilike('title', c.name).limit(1)
  const patch = { contact: c.contact, address: c.address, reg: c.reg }
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v))
  if (data?.[0]) {
    if (Object.keys(clean).length) await supabase.from('records').update({ meta: { ...(data[0].meta as object), ...clean } }).eq('id', data[0].id)
  } else {
    await supabase.from('records').insert({ category: 'customer', status: 'active', title: c.name, meta: clean })
  }
}

// ------------------------------------------------------------------ the money

const money = (n: number, c: Currency) => `${c} ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const netOf = (d: Draft) => Math.max((d.amount ?? 0) - (d.discount ?? 0), 0)

/** Parse "2500", "rm 2,500", "USD 1150", "1,588.50" into an amount + currency. */
export function parseMoney(text: string): { amount: number; currency: Currency } | null {
  const t = text.trim().toUpperCase().replace(/,/g, '')
  let currency: Currency = 'MYR'
  for (const c of CURRENCIES) if (t.includes(c)) currency = c
  if (/\bRM\b/.test(t)) currency = 'MYR'
  const m = t.match(/(\d+(?:\.\d{1,2})?)/)
  if (!m) return null
  const amount = Number(m[1])
  return Number.isFinite(amount) && amount > 0 ? { amount, currency } : null
}

// ------------------------------------------------------------------ the steps

export type Ask = { text: string; buttons?: InlineKeyboard }

const b = (text: string, data: string) => ({ text, callback_data: data })

/** What to ask for the step the draft is currently on. */
export function ask(draft: Draft): Ask {
  switch (draft.step) {
    case 'client':
      return {
        text:
          `🧾 <b>New ${draft.kind === 'quotation' ? 'quotation' : 'invoice'}</b>\n\n` +
          "Who is it for? Type part of the company name — I'll check who you've worked with before.\n\n" +
          '<i>Send /cancel any time to stop.</i>',
      }
    case 'client_details':
      return { text: 'New client. Send their details in one message, one per line:\n\n<code>Company legal name\nRegistration no (or -)\nContact person (or -)\nFull address</code>' }
    case 'job':
      return { text: 'What is the job called?\n\n<i>e.g. Awards Ceremony Photography</i>' }
    case 'venue':
      return { text: 'Where is it?\n\n<i>e.g. Sime Motors, Ara Damansara</i>' }
    case 'event_date':
      return { text: 'What date is the job itself?\n\n<i>e.g. 22/10/26</i>', buttons: [[b('Same as the invoice date', 'inv:edate:same')]] }
    case 'event_time':
      return { text: 'How long, and when?\n\n<i>e.g. 4 hours (4:00pm – 8:00pm)</i>' }
    case 'deliverables':
      return { text: 'What are you delivering? One per line.\n\n<i>e.g.\n1 x IG reel synced to TikTok\n1 x IG story\n1 month usage rights</i>' }
    case 'amount':
      return { text: 'How much? Currency optional — MYR is assumed.\n\n<i>e.g. 2500 · RM 3,200 · USD 1150</i>' }
    case 'discount':
      return {
        text: 'Any discount off that? It goes on the invoice as its own line, not hidden in the price.',
        buttons: [[b('No discount', 'inv:disc:0')]],
      }
    case 'terms':
      return {
        text: 'Payment terms?',
        buttons: [
          [b('50% deposit / 50% on delivery', 'inv:terms:half')],
          [b('Full payment on delivery', 'inv:terms:ondelivery')],
          [b('Within 30 days', 'inv:terms:net30')],
        ],
      }
    case 'quotation':
      return {
        text: 'Is there a quotation reference for this?',
        buttons: [[b('No quotation', 'inv:quote:none')]],
      }
    case 'validity':
      return {
        text: 'How long should this quotation stay valid?',
        buttons: [[b('14 days', 'inv:valid:14'), b('30 days', 'inv:valid:30')]],
      }
    case 'date':
      return {
        text: 'Invoice date?',
        buttons: [[b('Today', 'inv:date:today')]],
      }
    case 'confirm':
      return { text: summary(draft), buttons: [[b('✅ Create it', 'inv:go'), b('✖️ Discard', 'inv:cancel')]] }
  }
}

export function summary(d: Draft): string {
  const cur = d.currency ?? 'MYR'
  const lines = [
    `<b>Check this ${d.kind === 'quotation' ? 'quotation' : 'invoice'} over</b>`,
    '',
    `<b>Client</b>  ${d.client?.name ?? '—'}`,
    d.client?.contact ? `<b>Attn</b>  ${d.client.contact}` : '',
    `<b>Job</b>  ${d.job ?? '—'}`,
    d.venue ? `<b>Venue</b>  ${d.venue}` : '',
    d.eventDate ? `<b>Job date</b>  ${d.eventDate}` : '',
    d.eventTime ? `<b>Time</b>  ${d.eventTime}` : '',
    '',
    ...(d.deliverables ?? []).map(x => `  • ${x}`),
    '',
    `<b>Amount</b>  ${money(d.amount ?? 0, cur)}`,
    d.discount ? `<b>Discount</b>  −${money(d.discount, cur)}` : '',
    d.discount ? `<b>Total</b>  ${money(netOf(d), cur)}` : '',
    `<b>Date</b>  ${d.date ?? '—'}`,
    d.quotation ? `<b>Quotation ref</b>  ${d.quotation}` : '',
    d.validityDays ? `<b>Valid for</b>  ${d.validityDays} days` : '',
    '',
    `<i>The ${d.kind === 'quotation' ? 'quotation' : 'invoice'} number is issued when you confirm, so it can never clash.</i>`,
  ]
  return lines.filter(Boolean).join('\n')
}

/** Move to the next step, skipping the ones that don't apply to this document. */
export function advance(draft: Draft): Draft {
  const order = [...STEPS]
  let next = order[Math.min(order.indexOf(draft.step) + 1, order.length - 1)]
  const skip = (s: Step) =>
    // Ask for details only when the client is new or we hold no address for them.
    (s === 'client_details' && !draft.client?.isNew && !!draft.client?.address) ||
    // A quotation has no quotation reference; an invoice has no validity period.
    (s === 'quotation' && draft.kind === 'quotation') ||
    (s === 'validity' && draft.kind !== 'quotation')
  while (skip(next) && next !== 'confirm') next = order[order.indexOf(next) + 1]
  return { ...draft, step: next }
}

// ------------------------------------------------------------------- filing

/**
 * Turn a confirmed draft into a real invoice row — the same shape the Canva
 * import produced, so every tab, chart and total picks it up with no special
 * casing. `render.status = 'pending'` marks it as awaiting its Canva document.
 */
export async function fileInvoice(draft: Draft): Promise<{ no: string; id: number } | null> {
  if (!supabaseConfigured) return null
  const isQuote = draft.kind === 'quotation'
  const date = draft.date ?? new Date().toISOString().slice(0, 10)
  const no = await nextInvoiceNo(date, draft.kind)
  const cur = draft.currency ?? 'MYR'
  const net = netOf(draft)
  const project = [draft.job, ...(draft.deliverables ?? [])].filter(Boolean).join(' — ')
  const short = project.length > 60 ? project.slice(0, 57) + '…' : project

  const { data, error } = await supabase
    .from('records')
    .insert({
      // A quotation is NOT income. It is filed as a `doc` so no total, chart or
      // brief can ever mistake a quoted figure for money earned — the mistake the
      // old Canva folder made by keeping quotations beside invoices.
      category: isQuote ? 'doc' : 'cash_in',
      status: isQuote ? 'quotation' : 'issued',
      amount: net,
      due_date: null,
      created_at: `${date}T09:00:00+08:00`,
      title: `${no} · ${short}`,
      notes: project,
      meta: {
        customer: draft.client?.name,
        contact: draft.client?.contact || undefined,
        address: draft.client?.address || undefined,
        reg: draft.client?.reg || undefined,
        invoice_no: no,
        invoice_date: date,
        currency: cur === 'MYR' ? undefined : cur,
        list_price: draft.discount ? draft.amount : undefined,
        discount: draft.discount || undefined,
        deliverables: draft.deliverables,
        job: draft.job,
        venue: draft.venue,
        event_date: draft.eventDate,
        event_time: draft.eventTime,
        terms: draft.terms,
        quotation_no: draft.quotation || undefined,
        validity_days: draft.validityDays || undefined,
        source: 'telegram',
        payment_tracked: false,
        render: { status: 'pending' },
      },
    })
    .select('id')
    .single()

  if (error || !data) return null
  if (draft.client?.name) await rememberClient(draft.client).catch(() => {})
  return { no, id: data.id }
}
