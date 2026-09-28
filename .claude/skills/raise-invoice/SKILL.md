---
name: raise-invoice
description: Raise an invoice or quotation via the Telegram bot (/invoice, /quote) — the interview flow, numbering rules, Canva template editing, and exporting the finished PDF to Google Drive. Use when creating, editing, or troubleshooting an invoice or quotation.
---

## Raising an invoice or a quotation

`/invoice` and `/quote` in Telegram run the SAME eight-question interview (`lib/invoice-bot.ts`
drives the chat, `lib/invoice-intake.ts` holds the rules). An invoice files a `cash_in` row; a
quotation files a `doc` row with status `quotation`.

**A quotation is never income.** It is filed outside `cash_in` so no total, chart or brief can
mistake a quoted figure for money earned — the exact mistake the old Canva folder made by keeping
quotations next to invoices. Quotations get their own number series, `SYCP-Q-YYYYMM-NNN`.

- **The number is issued by the database**, never typed: `SYCP-YYYYMM-NNN`, restarting at 001 each
  month, taken from the highest number already filed that month. This is what makes the duplicate
  numbers found in the 2021–2023 book impossible to repeat.
- A discount is its own field and its own line — never folded into the price.
- The row lands with `meta.render.status = 'pending'`; `/pending` lists those.

Both documents are drawn from two canonical Canva templates in the folder **SYCP Templates (bot)**:
`TEMPLATE · Invoice` (`DAHV7BUsplg`) and `TEMPLATE · Quotation` (`DAHV7GY129w`). Both descend from
the quotation Aereon corrected by hand on 22 Sep 2026 — the invoice is a copy of it with only the
wording changed — so the layouts are identical by construction and cannot drift apart. A Canva copy
inherits element ids, so ONE locator map in `lib/invoice-render.ts` drives both.

**Do not "simplify" `buildOperations()` into plain `replace_text`.** Canva cannot create mixed
bold/normal text inside one element; it can only preserve runs that already exist. Inserted text
inherits the formatting of the character immediately before it, so writing at the start of a run
silently adopts the previous run's weight — which is why the client address kept coming out bold.
The two-step `{{TOKEN}}` pattern in that file exists solely to avoid this. Its header explains it.

⚠️ Existing quotations live only in Canva, not in the database, so `SYCP-Q-` numbering currently
counts from zero for any month with no filed quote. Importing the quotation history would close that
gap and give quote→win-rate analysis.

**Finished documents are filed by type** — `FOLDERS` in `lib/invoice-render.ts`: quotations into
Canva's "Quotation" folder. Never put a quotation in Invoices; that mixing is exactly what made the
2021–2026 back catalogue so hard to audit.

**Invoices are filed by year**, not into one flat folder — the original single "Invoices" folder
hit Canva's 200-item-per-folder cap on 27 Sep 2026. The structure is now "Invoices" (parent) →
"Invoices (YYYY)" per year, picked by the invoice's own date; `invoiceYearFolders` in
`lib/invoice-render.ts` holds the ids and needs a new entry each January. A draft re-rendered to fix
something goes to "TODO: Delete" (`FOLDERS.todoDelete`, at the account root) instead of sitting in
its year folder next to the good copy — Claude has no tool to delete a Canva design outright, so
Aereon clears that folder by hand periodically.

The Canva document is a **separate, Claude-driven step**. Canva's design-editing API exists only in
the MCP connector — Composio and the public Connect API cannot edit a design — so the app cannot do
it. `lib/invoice-render.ts` holds the locator map and `buildOperations()`, which keeps that step to
four cheap calls instead of a 9,000-token re-read of the element tree each time. Read the header of
that file before touching it; it explains the token arithmetic.

**After the Canva document is committed, export it and file the PDF in Google Drive** — this is a
separate, near-free step from the edit above, and doesn't need Aereon to ask each time:

1. Canva's `export-design` (format `pdf`) returns a presigned download URL for the finished page.
2. Hand that URL straight to `GOOGLEDRIVE_UPLOAD_FROM_URL` (via `composio execute`, not the app) as
   `source_url` — Google's own servers fetch the PDF directly from Canva's URL. **No PDF bytes ever
   pass through Claude or a local download**; routing them through `curl`/base64 first is a wasted,
   slower detour (tried once, 27 Sep 2026 — don't repeat it).
3. File into the Google Drive folder from `getInvoiceExportConfig()` in `lib/invoice-export.ts`
   (reads the `invoice_export` row via `lib/settings.ts` — a generic key/value store in the same
   `records` table, so changing the destination is `setSetting('invoice_export', {...})`, never a
   code change). It currently points at **"SYCP Client Invoice"** (Drive folder id
   `1NQJsEAXTN6iSiuiNG_DhQ7aeUU2b9srW`) — the flat top-level folder, not a year subfolder. Aereon's
   accountant checks that folder and sorts each PDF into its own year folder from there, so Claude
   never guesses a year on the Drive side (Canva's own year-subfolder filing is unrelated and still
   applies — see above).
4. Use `exportFilename(invoiceNo, job)` from the same file for the name, matching the back
   catalogue's existing `SYCP-YYYYMM-NNN - Job Name.pdf` convention.

## From the dashboard (27 Sep 2026) — no Claude in the loop

Invoice Details (`/invoices/details`) has its own **Create invoice** button. It runs the same render
as above, but from the app's server through Composio's `canva_mcp` toolkit (`lib/invoice-canva.ts`) —
that toolkit DOES expose copy/start-transaction/perform-editing-operations/commit, so the note above
about Composio not editing designs applies only to Canva's public Connect API. The only difference is
the field name: Composio calls the element `element_id` where the MCP connector says `locator_id`.
The preview is the thumbnail of the still-uncommitted transaction; Save commits it and files the row.

Drive status lives on the invoice row as `meta.drive` (`lib/invoice-drive.ts`). Upload is a separate
manual click per row; never re-uploads a row already `uploaded`. After a hand fix in Canva, the ↻
**Re-upload** button beside "In Drive" (`reuploadInvoiceToDrive`) exports the design again, uploads
the new PDF first, and only then moves the old Drive file to trash (`meta.drive.replaced_file_id`). `npm run drive:reconcile -- --year YYYY`
back-fills rows whose PDFs are already in Drive (dry run unless `--write`).

## Telegram now draws in Canva itself (27 Sep 2026)

`/invoice` and `/quote` no longer leave the document `pending`. At the summary, **Create it in Canva**
runs the same Claude-free render as the dashboard (`lib/invoice-canva.ts`), sends the thumbnail as a
photo with **Save / Discard**, and only on Save commits the design and files the row
(`fileInvoice(draft, { no, meta })`). A saved invoice offers a **☁️ Upload PDF to Google Drive** button
(`inv:drive:<id>`); quotations don't. If the server has no Composio key it falls back to the old
file-now, render-later behaviour, so `/pending` only matters for older rows.
