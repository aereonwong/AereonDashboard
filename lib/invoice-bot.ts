import { sendMessage, sendWithButtons } from './telegram'
import {
  ask,
  advance,
  loadDraft,
  saveDraft,
  clearDraft,
  findClients,
  parseMoney,
  fileInvoice,
  TERMS,
  type Draft,
} from './invoice-intake'
import { parseEventDates } from './event-dates'
import type { DocKind } from './invoice-render'

// 👉 The Telegram side of the invoice interview: it owns the conversation, and
// lib/invoice-intake.ts owns the rules. Every reply routes through here while a
// draft is open, so a half-finished invoice can't be mistaken for a question to
// the AI.

const todayKL = () =>
  new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10) // UTC+8

/** Accepts 2026-10-22 or 22/10/26 or 22-10-2026. */
function parseDate(text: string): string | null {
  const t = text.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (!dmy) return null
  const [, dd, mm, yy] = dmy
  return `${yy.length === 2 ? `20${yy}` : yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

async function put(chatId: number, draft: Draft) {
  await saveDraft(chatId, draft)
  const a = ask(draft)
  if (a.buttons) await sendWithButtons(chatId, a.text, a.buttons)
  else await sendMessage(chatId, a.text)
}

/** /invoice and /quote — begin, replacing any half-finished one. */
export async function startInvoice(chatId: number, kind: DocKind = 'invoice'): Promise<void> {
  await clearDraft(chatId)
  await put(chatId, { kind, step: 'client' })
}

/** True if this chat has an interview running and the text was consumed. */
export async function handleInvoiceText(chatId: number, text: string): Promise<boolean> {
  const open = await loadDraft(chatId)
  if (!open) return false
  const d = open.draft

  if (/^\/cancel$/i.test(text)) {
    await clearDraft(chatId)
    await sendMessage(chatId, 'Dropped it. Nothing was filed.')
    return true
  }
  // Any other command aborts the interview rather than being swallowed.
  if (text.startsWith('/') && !/^\/(invoice|quote|quotation)$/i.test(text)) {
    await clearDraft(chatId)
    await sendMessage(chatId, 'Invoice cancelled — you sent another command.')
    return false
  }

  switch (d.step) {
    case 'client': {
      // A bare number answers an earlier shortlist rather than naming a client.
      if (d.matches?.length && /^\d+$/.test(text.trim())) {
        const pick = d.matches[Number(text.trim()) - 1]
        if (!pick) {
          await sendMessage(chatId, `Pick a number between 1 and ${d.matches.length}.`)
          return true
        }
        await sendMessage(chatId, `Using <b>${pick.name}</b>.`)
        await put(chatId, advance({ ...d, client: { ...pick }, matches: undefined }))
        return true
      }
      const found = await findClients(text)
      if (found.length === 0) {
        await put(chatId, {
          ...d,
          step: 'client_details',
          client: { name: text.trim(), isNew: true },
        })
        return true
      }
      if (found.length === 1) {
        await sendMessage(chatId, `Using <b>${found[0].name}</b>.`)
        await put(chatId, advance({ ...d, client: { ...found[0] } }))
        return true
      }
      const list = found.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
      await saveDraft(chatId, { ...d, matches: found })
      await sendMessage(chatId, `Which one?\n\n${list}\n\nReply with a number, or type a fuller name.`)
      return true
    }

    case 'client_details': {
      const [name, reg, contact, ...rest] = text.split('\n').map(s => s.trim())
      await put(
        chatId,
        advance({
          ...d,
          step: 'client_details',
          client: {
            name: name || d.client?.name || 'Unknown',
            reg: reg && reg !== '-' ? reg : undefined,
            contact: contact && contact !== '-' ? contact : undefined,
            // Kept as separate lines, not joined by comma, so Aereon controls
            // exactly where the address wraps on the printed invoice.
            address: rest.join('\n') || undefined,
          },
        }),
      )
      return true
    }

    case 'job':
      await put(chatId, advance({ ...d, job: text.trim() }))
      return true

    case 'venue':
      await put(chatId, advance({ ...d, venue: text.trim() }))
      return true

    case 'event_date': {
      const ev = parseEventDates(text)
      if (!ev) {
        await sendMessage(
          chatId,
          "I couldn't read that date. Try <code>22/10/26</code>, <code>1st to 3rd September 2026</code>, <code>31st Aug, 3rd Sept 2026</code> or <code>31st Dec 2025 and 1st Jan 2026</code> — or tap the button.",
        )
        return true
      }
      await put(chatId, advance({ ...d, eventDate: ev.dates[0], eventDates: ev.dates, eventDateLabel: ev.label }))
      return true
    }

    case 'event_time':
      await put(chatId, advance({ ...d, eventTime: text.trim() }))
      return true

    case 'deliverables':
      await put(
        chatId,
        advance({ ...d, deliverables: text.split('\n').map(s => s.replace(/^[-•]\s*/, '').trim()).filter(Boolean) }),
      )
      return true

    case 'amount': {
      const m = parseMoney(text)
      if (!m) {
        await sendMessage(chatId, "I couldn't read an amount there. Try something like <code>2500</code> or <code>USD 1150</code>.")
        return true
      }
      await put(chatId, advance({ ...d, amount: m.amount, currency: m.currency }))
      return true
    }

    case 'discount': {
      const m = parseMoney(text)
      if (!m) {
        await sendMessage(chatId, 'Send the discount as a number, or tap <b>No discount</b>.')
        return true
      }
      if (m.amount >= (d.amount ?? 0)) {
        await sendMessage(chatId, `That discount is not smaller than the amount (${d.amount}). Send a smaller number.`)
        return true
      }
      await put(chatId, advance({ ...d, discount: m.amount }))
      return true
    }

    case 'terms':
      await put(chatId, advance({ ...d, terms: text.trim() }))
      return true

    case 'quotation':
      await put(chatId, advance({ ...d, quotation: text.trim() }))
      return true

    case 'validity': {
      const days = Number(text.trim().match(/\d+/)?.[0])
      if (!Number.isFinite(days) || days <= 0) {
        await sendMessage(chatId, 'Send a number of days, or tap one of the buttons.')
        return true
      }
      await put(chatId, advance({ ...d, validityDays: days }))
      return true
    }

    case 'date': {
      const date = parseDate(text)
      if (!date) {
        await sendMessage(chatId, 'Send the date as <code>DD/MM/YY</code>, or tap <b>Today</b>.')
        return true
      }
      await put(chatId, advance({ ...d, date }))
      return true
    }

    case 'confirm': {
      // A number here picks from an earlier client shortlist; otherwise nudge.
      await sendMessage(chatId, 'Tap <b>Create it</b> or <b>Discard</b> above.')
      return true
    }
  }
  return true
}

/** Handles inv:* button taps. Returns true if it was ours. */
export async function handleInvoiceCallback(chatId: number, data: string): Promise<boolean> {
  if (!data.startsWith('inv:')) return false
  const open = await loadDraft(chatId)
  if (!open) {
    await sendMessage(chatId, 'That invoice is no longer open. Send /invoice to start again.')
    return true
  }
  const d = open.draft
  const [, kind, value] = data.split(':')

  if (kind === 'cancel') {
    await clearDraft(chatId)
    await sendMessage(chatId, 'Discarded. Nothing was filed.')
    return true
  }
  if (kind === 'disc') {
    await put(chatId, advance({ ...d, discount: 0 }))
    return true
  }
  if (kind === 'terms') {
    await put(chatId, advance({ ...d, terms: TERMS[value] ?? TERMS.half }))
    return true
  }
  if (kind === 'quote') {
    await put(chatId, advance({ ...d, quotation: undefined }))
    return true
  }
  if (kind === 'valid') {
    await put(chatId, advance({ ...d, validityDays: Number(value) || 14 }))
    return true
  }
  if (kind === 'edate') {
    const ev = parseEventDates(d.date ?? todayKL())!
    await put(chatId, advance({ ...d, eventDate: ev.dates[0], eventDates: ev.dates, eventDateLabel: ev.label }))
    return true
  }
  if (kind === 'date') {
    await put(chatId, advance({ ...d, date: todayKL() }))
    return true
  }
  if (kind === 'go') {
    const filed = await fileInvoice({ ...d, date: d.date ?? todayKL() })
    await clearDraft(chatId)
    if (!filed) {
      await sendMessage(chatId, '⚠️ Could not file that — the database refused it. Nothing was saved.')
      return true
    }
    const isQuote = d.kind === 'quotation'
    await sendMessage(
      chatId,
      `✅ Filed as <b>${filed.no}</b>.\n\n` +
        (isQuote
          ? 'Quotations are kept out of your income totals, so nothing on the Dashboard moved.'
          : "It's already in your Invoice Summary and counted on the Dashboard.") +
        `\n\nThe Canva document is still to be made — it's queued as <i>pending</i>.`,
    )
    return true
  }
  return true
}
