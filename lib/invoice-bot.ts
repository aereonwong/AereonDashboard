import { sendMessage, sendWithButtons, sendPhotoWithButtons } from './telegram'
import {
  ask,
  advance,
  loadDraft,
  saveDraft,
  clearDraft,
  findClients,
  parseMoney,
  fileInvoice,
  invoiceRow,
  nextInvoiceNo,
  TERMS,
  type Draft,
} from './invoice-intake'
import { parseEventDates } from './event-dates'
import type { DocKind } from './invoice-render'
import type { Rec } from './records'
import { startRender, commitRender, discardRender } from './invoice-canva'
import { uploadInvoiceToDrive } from './invoice-drive-upload'
import { composioReady } from './composio-exec'

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
    if (d.preview) await discardRender(d.preview).catch(() => {})
    await clearDraft(chatId)
    await sendMessage(chatId, 'Dropped it. Nothing was filed.')
    return true
  }
  // Any other command aborts the interview rather than being swallowed.
  if (text.startsWith('/') && !/^\/(invoice|quote|quotation)$/i.test(text)) {
    if (d.preview) await discardRender(d.preview).catch(() => {})
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
      await put(chatId, advance({ ...d, venue: text.trim() === '-' ? '—' : text.trim() }))
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

    case 'confirm':
      await sendMessage(chatId, 'Tap <b>Create it in Canva</b> or <b>Discard</b> above — or /cancel to start over.')
      return true

    case 'preview':
      await sendMessage(chatId, 'Tap <b>Save</b> or <b>Discard</b> under the preview — or /cancel to throw it away.')
      return true
  }
  return true
}

/** Handles inv:* button taps. Returns true if it was ours. */
export async function handleInvoiceCallback(chatId: number, data: string): Promise<boolean> {
  if (!data.startsWith('inv:')) return false

  // ☁️ Upload to Drive on an invoice that's already saved — no draft involved.
  if (data.startsWith('inv:drive:')) {
    const id = Number(data.split(':')[2])
    await sendMessage(chatId, '☁️ Uploading the PDF to Google Drive…')
    const res = await uploadInvoiceToDrive(id)
    await sendMessage(
      chatId,
      res.ok
        ? `✅ In Google Drive: <a href="${res.drive.url}">open the PDF</a>`
        : `⚠️ Drive upload failed: ${res.error}\nYou can retry from Invoice Details.`,
    )
    return true
  }

  const open = await loadDraft(chatId)
  if (!open) {
    await sendMessage(chatId, 'That invoice is no longer open. Send /invoice to start again.')
    return true
  }
  const d = open.draft
  const [, kind, value] = data.split(':')

  if (kind === 'cancel' || kind === 'discard') {
    if (d.preview) await discardRender(d.preview).catch(() => {})
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
    // Only from the summary — a second tap while Canva is drawing is ignored.
    if (d.step !== 'confirm') return true
    const draft = { ...d, date: d.date ?? todayKL() }

    // No Canva connection on this server: file it the old way, document pending.
    if (!composioReady()) {
      const filed = await fileInvoice(draft)
      await clearDraft(chatId)
      await sendMessage(
        chatId,
        filed
          ? `✅ Filed as <b>${filed.no}</b>. Canva isn't connected here, so its document is queued as <i>pending</i>.`
          : '⚠️ Could not file that — the database refused it. Nothing was saved.',
      )
      return true
    }

    await saveDraft(chatId, { ...draft, step: 'preview' })
    await sendMessage(chatId, '🎨 Drawing it in Canva… about 15 seconds.')
    try {
      const no = await nextInvoiceNo(draft.date, draft.kind)
      const row = invoiceRow(draft, no)
      const p = await startRender({ ...row, id: 0 } as unknown as Rec, draft.kind)
      await saveDraft(chatId, { ...draft, step: 'preview', preview: { no, designId: p.designId, transactionId: p.transactionId, viewUrl: p.viewUrl } })
      const caption =
        `<b>${no}</b> — check it over.\nNothing is saved yet: <b>Save</b> keeps this Canva design and files the ${draft.kind === 'quotation' ? 'quotation' : 'invoice'}.`
      const buttons = [[{ text: '✅ Save', callback_data: 'inv:save' }, { text: '✖️ Discard', callback_data: 'inv:discard' }]]
      const sent = p.previewUrl && (await sendPhotoWithButtons(chatId, p.previewUrl, caption, buttons))
      if (!sent) await sendWithButtons(chatId, `${caption}\n\n(Canva sent no preview picture.)`, buttons)
    } catch (e) {
      await saveDraft(chatId, { ...draft, step: 'confirm', preview: undefined })
      await sendWithButtons(chatId, `⚠️ Canva couldn't draw it: ${e instanceof Error ? e.message : e}\n\nNothing was saved. Try again?`, [
        [{ text: '🎨 Try again', callback_data: 'inv:go' }, { text: '✖️ Discard', callback_data: 'inv:cancel' }],
      ])
    }
    return true
  }

  if (kind === 'save') {
    const p = d.preview
    if (d.step !== 'preview' || !p) return true
    await saveDraft(chatId, { ...d, step: 'confirm', preview: undefined }) // a double tap can't save twice
    const date = d.date ?? todayKL()

    // The number is printed on the design, so it must still be the next free one.
    if ((await nextInvoiceNo(date, d.kind)) !== p.no) {
      await discardRender(p).catch(() => {})
      await sendWithButtons(chatId, `⚠️ ${p.no} was taken by another document meanwhile. Nothing was saved — draw it again for the next number.`, [
        [{ text: '🎨 Draw it again', callback_data: 'inv:go' }, { text: '✖️ Discard', callback_data: 'inv:cancel' }],
      ])
      return true
    }
    try {
      await commitRender({ designId: p.designId, transactionId: p.transactionId, invoiceDate: date, kind: d.kind })
    } catch (e) {
      await sendWithButtons(chatId, `⚠️ Canva couldn't save the design: ${e instanceof Error ? e.message : e}. Nothing was filed.`, [
        [{ text: '🎨 Draw it again', callback_data: 'inv:go' }, { text: '✖️ Discard', callback_data: 'inv:cancel' }],
      ])
      return true
    }
    const now = new Date().toISOString()
    const canvaUrl = p.viewUrl ?? `https://www.canva.com/design/${p.designId}/view`
    const filed = await fileInvoice(
      { ...d, date },
      {
        no: p.no,
        meta: {
          canva_design: p.designId,
          canva_url: canvaUrl,
          render: { status: 'done', design_id: p.designId, rendered_at: now, source: 'telegram' },
        },
      },
    )
    await clearDraft(chatId)
    if (!filed) {
      await sendMessage(chatId, `⚠️ The Canva design was saved (<a href="${canvaUrl}">open it</a>) but the database refused the row. Tell Claude.`)
      return true
    }
    const isQuote = d.kind === 'quotation'
    const text =
      `✅ <b>${filed.no}</b> saved — <a href="${canvaUrl}">open in Canva</a>.\n\n` +
      (isQuote
        ? 'Filed in Canva\'s Quotation folder. Quotations stay out of your income totals.'
        : `Filed in Canva's Invoices (${date.slice(0, 4)}) folder and counted in Invoice Summary.\nThe PDF is not in Google Drive yet — tap below when you want it there.`)
    if (isQuote) await sendMessage(chatId, text)
    else await sendWithButtons(chatId, text, [[{ text: '☁️ Upload PDF to Google Drive', callback_data: `inv:drive:${filed.id}` }]])
    return true
  }
  return true
}
