---
name: raise-invoice
description: Raise an invoice or quotation via the Telegram bot (/invoice, /quote) — the interview flow, numbering rules, Canva template editing, and exporting the finished PDF to Google Drive. Use when creating, editing, or troubleshooting an invoice or quotation.
---

# Raise an invoice or a quotation

An invoice is a document a client pays against; a quotation is an offer. Both are a database row
**plus** a Canva design **plus** (invoices only) a PDF in Google Drive. This skill covers making,
splitting, revising and troubleshooting them.

Also read: `docs/INVOICE-AUDIT.md` before changing how invoices are parsed or designing a template;
`app/(app)/invoices/quotes/CLAUDE.md` for quotation rules; `invoice-auditor` reviews any code change here.

## Never

- **Never type, guess or reuse a number.** The database issues it.
- **Never count a quotation as income**, file it as `cash_in`, or put it in an Invoices folder.
- Never fold a discount into the price — it is its own field and its own line.
- Never print "—" for a missing venue or job date — drop those lines.
- Never convert a foreign-currency invoice to RM or print "RM" on it.
- Never put the full contract as the TOTAL on a deposit or balance invoice.
- Never trust Canva's "applied" — read the drawn design back before saving.
- Never "simplify" `buildOperations()` into plain `replace_text` (see Reference → Canva).
- Never route PDF bytes through Claude, `curl` or base64 — hand Canva's URL straight to Drive.
- Never renumber, re-render or "tidy" a historical invoice or an imported quote.
- Never edit a sent invoice in place — edit a COPY of its design, retire the old one.
- Never file a personal `AW-` invoice into SYCP's books or folders.
- Never send the document to the client yourself. Aereon sends.

## 1. Pick the path

| Aereon wants… | Path |
|---|---|
| A normal invoice or quotation, Aereon at the dashboard | **A. Dashboard** — no Claude needed |
| The same, from the phone | **B. Telegram** `/invoice` or `/quote` (only while the bot is on: `TELEGRAM_BOT=on`) |
| Claude to make it in this chat ("raise an invoice for X") | **C. Claude-driven** |
| The balance for an existing deposit invoice | **D. Balance button** |
| A job billed as deposit + balance, set up by hand | **E. Manual split** |
| A fix to an invoice that already went out | **F. Revise** |
| An invoice paid to Aereon personally, not the company | **G. Personal (AW-)** |

### What to collect first (paths B, C, E)

The same eight questions the bot asks (`lib/invoice-intake.ts` holds the rules):
client (name + billing address) · job name · line items (description, price, qty) · discount, if
any · currency (default MYR) · invoice date and job date · venue · payment terms and, if it
answers a quote, the quotation number. Ask only for what is missing; never invent an address or
a price. No venue or job date → leave them out.

## 2. The paths

### A. Dashboard — Create invoice / Create quotation

Invoice Details (`/invoices/details`) → **Create invoice**; Quotations (`/invoices/quotes`) →
**Create quotation**, or **Convert** on a quote to open the invoice dialog pre-filled. The app's
server draws it through Composio's `canva_mcp` toolkit (`lib/invoice-canva.ts`). The preview is the
thumbnail of the still-uncommitted transaction; **Save** commits the design and files the row.
Drive upload is a separate click per row (☁️), invoices only.

### B. Telegram

`/invoice` and `/quote` run the same interview (`lib/invoice-bot.ts`). At the summary, **Create it
in Canva** runs the same render as the dashboard, sends the thumbnail with **Save / Discard**, and
only on Save commits the design and files the row (`fileInvoice(draft, { no, meta })`). A saved
invoice offers **☁️ Upload PDF to Google Drive** (`inv:drive:<id>`); quotations don't. With no
Composio key on the server it falls back to file-now, render-later: the row lands with
`meta.render.status = 'pending'` and `/pending` lists it.

### C. Claude-driven

1. Collect the fields; show Aereon a one-screen summary; get a yes.
2. Prefer path A's server action if a session is available. Otherwise file the row through
   `fileInvoice` (it issues the number) — never insert a row with a hand-made number.
3. Copy the right template (`TEMPLATES` in `lib/invoice-render.ts`), run the operations from
   `buildOperations()` — four calls: copy, start transaction, perform operations, commit.
4. **Read the design back** and compare field by field with the row: number, date, client,
   address, each line, discount, subtotal, total, currency, terms, bank account.
5. Show Aereon the thumbnail. Only after a yes: commit, move the design to its folder, then
   export to Drive (step 3 below).

### D. Balance button (since 12 Nov 2026)

Invoice Details shows `deposit 30% · + raise balance` under a deposit's number →
`BalanceInvoice.tsx` → `previewBalance` / `saveBalance` (`app/(app)/invoices/actions.ts`), maths in
`lib/invoice-split.ts` (tested). It copies the DEPOSIT's own Canva design (so hand fixes carry
over), takes the next free number for the chosen date's month, and rewrites: number, date, QTY to
the rest of the %, amount / subtotal / total to contract − deposit, and the two split lines. The
drawn result is read back (`checkDrawn`) and the preview is refused unless the new number, date,
%, amounts and both lines are printed and the deposit's lines are gone. Save files the balance
row (`split.part = 'balance'`) and sets the deposit's `split.balance_invoice`.

Refused, by design: a deposit with a `discount`; a deposit whose balance is already filed (checked
by `meta.split.deposit_invoice`, not only the deposit's link); **Edit Invoice** on either half (a
template redraw would drop the split lines — fix in Canva by hand, then Re-upload). The balance
inherits tracking: an `issued` / `payment_tracked: false` deposit gives an `issued` balance.

### E. Manual split — deposit + balance as two invoices

Each invoice's **TOTAL is only what that invoice asks for** — the client's accounts team pays the
total box, and the books count every row.

- Line item: PRICE = full contract, QTY = the percent (`50%`, `30%`), AMOUNT / SUBTOTAL / TOTAL =
  the part.
- Under Payment Terms, use `depositLines()` from `lib/invoice-split.ts` — don't hand-write them.
- The deposit keeps its own number and month; the balance takes the next number in ITS month.
- Rows: one `cash_in` row per invoice at the part amount (the two sum to the contract), both with
  the same `quotation_id`.
- For the balance button to work later, the deposit row MUST carry:

  ```
  meta.split = {
    part: 'deposit', percent,            // percent = the DEPOSIT's share
    contract_value, deposit_invoice, balance_invoice: null,
    terms_locator: '<element holding Payment Terms>',
    printed: { deposit, balance }        // the two lines EXACTLY as printed
  }
  ```

  and print QTY as `<percent>%`, the number line as `INVOICE No. <no>`, the date as `Date: DD/MM/YY`.
  Every later rewrite is a find-and-replace on those exact texts.
- The paid half: status `paid`, `payment_tracked: true`, `paid_on` = the bank date, `payment_ref`.
- Pairs filed before 12 Nov 2026 store no `percent`; Invoice Details shows them without one.

### F. Revise an invoice already issued

1. Copy its Canva design; edit the COPY.
2. Read back, show Aereon, get a yes.
3. Move the old design to **TODO: Delete**.
4. ↻ **Re-upload** beside "In Drive" (`reuploadInvoiceToDrive`): it exports again, uploads the new
   PDF first, and only then trashes the old Drive file (`meta.drive.replaced_file_id`).
5. Same number, same row. A change of amount on a sent invoice needs Aereon's explicit say-so.

### G. Personal invoice (AW-)

Numbered `AW-YYYY-MM-NN`, made by hand in Canva from the latest personal design (see memory
`personal-aw-invoices`), no company header, personal bank account. Not a `cash_in` row, not in
SYCP's Canva or Drive folders. Ask Aereon where the PDF goes.

## 3. Export to Google Drive (invoices only)

Near-free, and does not need Aereon to ask each time once the design is committed:

1. Canva `export-design` (format `pdf`) → a presigned download URL.
2. Hand that URL to `GOOGLEDRIVE_UPLOAD_FROM_URL` as `source_url` (via `composio execute`) —
   Google fetches the PDF from Canva directly.
3. Destination: `getInvoiceExportConfig()` in `lib/invoice-export.ts` (the `invoice_export` setting;
   change it with `setSetting('invoice_export', {...})`, never in code). Today: the flat
   **"SYCP Client Invoice"** folder (`1NQJsEAXTN6iSiuiNG_DhQ7aeUU2b9srW`). Aereon's accountant sorts
   PDFs into year folders from there — never guess a year on the Drive side.
4. Name: `exportFilename(invoiceNo, job)` → `SYCP-YYYYMM-NNN - Job Name.pdf`.
5. Status lives on the row as `meta.drive` (`lib/invoice-drive.ts`). Never re-upload a row already
   `uploaded`. `npm run drive:reconcile -- --year YYYY` back-fills rows whose PDFs are already in
   Drive (dry run unless `--write`).

## 4. Check before saying "done"

- [ ] Number issued by the database, next in its month, not seen before.
- [ ] Design read back and matches the row field by field.
- [ ] TOTAL = what this document asks for (split invoices: the part, not the contract).
- [ ] Currency right; no "RM" on a foreign invoice.
- [ ] No "—", no empty venue / job date lines, no leftover `{{TOKEN}}`.
- [ ] Design in the right Canva folder; superseded drafts in TODO: Delete.
- [ ] Invoice PDF in Drive with the `exportFilename` name; `meta.drive` says `uploaded`.
- [ ] Row status right: `issued` unless payment is tracked; a quotation is `doc` / `quotation`.

## What to tell Aereon — this shape

```
Invoice SYCP-202611-004 — Harbour Hotel, "Rooftop launch reel" — MYR 3,200.00
Canva: https://www.canva.com/design/…  (Invoices (2026))
Drive: SYCP-202611-004 - Rooftop launch reel.pdf → SYCP Client Invoice
Row: issued, payment not tracked · answers quotation SYCP-Q-202610-007
Checked: read back against the row — number, date, client, 2 lines, total, bank account all match.
Not done: not sent to the client — that's yours.
```

A split pair:

```
Deposit SYCP-202611-005 — 30% of MYR 2,500.00 = MYR 750.00 (TOTAL on this invoice)
Balance: not raised yet — use "+ raise balance" on Invoice Details when the job is delivered.
Row carries meta.split (percent 30, both printed lines), so the button will work.
```

When it stops:

```
Not saved. Canva drew the old date — read-back found "Date: 02/11/26", expected "Date: 15/11/26".
Nothing was filed and no number was used. The draft copy is in TODO: Delete.
```

## Reference

### Numbering and rows

- Invoices `SYCP-YYYYMM-NNN`, quotations `SYCP-Q-YYYYMM-NNN`; each restarts at 001 monthly and is
  taken from the highest number already filed that month. This is what makes the duplicate numbers
  of the 2021–2023 book impossible to repeat.
- An invoice files a `cash_in` row; a quotation files a `doc` row with status `quotation`, kept
  outside `cash_in` so no total, chart or brief can mistake a quoted figure for money earned.
- Quotation history is in the database (10 Oct 2026, `npm run quote:import`, record only — numbers
  kept as printed; `docs/QUOTE-AUDIT.md`), so `SYCP-Q-` numbering counts past every old quote.
- An invoice that names a quote (the `/invoice` quotation step, or Convert) gets `meta.quotation_id`
  as well as `quotation_no`; that link is what marks the quote won. One quote can win several invoices.
- `meta.job_date` is the day of the job, not the issue date.

### Canva

- Two canonical templates in the folder **SYCP Templates (bot)**: `TEMPLATE · Invoice`
  (`DAHV7BUsplg`) and `TEMPLATE · Quotation` (`DAHV7GY129w`). Both descend from the quotation Aereon
  corrected by hand on 22 Sep 2026 — the invoice is a copy with only the wording changed — so the
  layouts cannot drift apart. A Canva copy inherits element ids, so ONE locator map in
  `lib/invoice-render.ts` drives both.
- **Why `buildOperations()` must stay as it is:** Canva cannot create mixed bold/normal text inside
  one element; it only preserves runs that already exist. Inserted text inherits the formatting of
  the character before it, so writing at the start of a run adopts the previous run's weight —
  which is why the client address kept coming out bold. The two-step `{{TOKEN}}` pattern exists
  solely to avoid this; the file's header explains it and the token arithmetic (four cheap calls
  instead of a 9,000-token re-read of the element tree).
- **Who can edit a design:** the Canva MCP connector and Composio's `canva_mcp` toolkit both can
  (copy / start-transaction / perform-editing-operations / commit). Canva's public Connect API
  cannot. Field name differs: Composio says `element_id`, the MCP connector says `locator_id`.
- **A find that matched NOTHING is reported as applied** (tested 12 Nov 2026) — hence the read-back.
- **Filing:** `FOLDERS` in `lib/invoice-render.ts`. Quotations → "Quotation". Invoices → "Invoices"
  (parent) → "Invoices (YYYY)" by the invoice's own date; `invoiceYearFolders` holds the ids and
  **needs a new entry each January** (the flat folder hit Canva's 200-item cap on 27 Sep 2026). A
  re-rendered draft → "TODO: Delete" (`FOLDERS.todoDelete`, account root) — Claude cannot delete a
  Canva design, so Aereon clears that folder by hand.

### Split wording (`lib/invoice-split.ts`)

- Deposit invoice: `Deposit 30%: MYR 750.00 (payable on this invoice)` /
  `Balance 70%: MYR 1,750.00 (billed on a separate invoice, due by 31 December 2026)`.
- Balance invoice: `Less deposit (<no>): …` (or `Less deposit paid (<no>) on DD/MM/YY: …`) /
  `Balance due 70%: … (payable on this invoice)`.
- First pairs, for reference: SYCP-202610-006 / SYCP-202611-003 (50%, by hand, 7 Nov 2026) and
  SYCP-202610-004 (30% of MYR 2,500, the first through the button).

### Troubleshooting

| Symptom | Cause | Do |
|---|---|---|
| Client address comes out bold | text written at the start of a run | use `buildOperations()` as is |
| Preview refused, "not printed" | a find matched nothing | compare `meta.split.printed` with the design's exact text |
| "+ raise balance" missing | no `meta.split` on the deposit, or it has a discount | add `meta.split` (path E) / do the balance by hand |
| Canva folder full | 200-item cap | add the year to `invoiceYearFolders` |
| Row stuck `pending` | filed while the server had no Composio key | render from Invoice Details |
| Drive shows two PDFs | old file not trashed after a hand re-upload | use ↻ Re-upload, which trashes the old one last |
