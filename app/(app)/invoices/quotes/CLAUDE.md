# Quotations

Also applies to `lib/quotes.ts` and the quotation side of `lib/invoice-edit.ts`.

## Quotations (added 10 Oct 2026)

`/invoices/quotes` (v3 + classic sidebar, beside Invoice Details): every quote with its outcome — won / open /
no invoice / lost — and a **Convert** button that opens Create Invoice filled in from the quote. Logic in
`lib/quotes.ts`, page in `app/(app)/invoices/quotes/`. A quote is a `doc` row, status `quotation` — never income.
- **The quote → invoice link lives on the INVOICE only**: `meta.quotation_id` (firm; written by Convert, by
  `fileInvoice` when a typed reference names exactly one quote, and by the import) and `meta.quotation_no` (the
  `QUOTATION No.` it prints). Outcome is derived each render, never stored on the quote (except `quote_outcome:
  'lost'`). One quote can win several invoices (deposit + balance, add-ons).
- **Old Canva quotes are record-only** (Aereon's call): 65 imported by `npm run quote:import` from git-ignored
  `.quote-data/`, numbers kept exactly as printed (odd formats and repeats included), designs untouched.
  `docs/QUOTE-AUDIT.md` has the formats; the client-level findings are in git-ignored `.quote-data/QUOTE-AUDIT.md`.
- **Create quotation** (Quotations page header): the Create Invoice dialog with `kind="quotation"` — same Canva
  preview → Save flow as invoices and as Telegram `/quote`: `SYCP-Q-YYYYMM-NNN`, `TEMPLATES.quotation`, Canva's
  Quotation folder, a validity period instead of payment status/due date. Filed by `fileInvoice` as `doc`/`quotation`.
- **Edit / undo a quotation** (row buttons): same `lib/invoice-edit.ts` flow as invoices; the ROW decides the kind
  (`rowKind`), redrawn from the quotation template, status stays `quotation`, no Drive. Old-format quotes
  (`source: 'canva_quote'`) and quotes without a recorded template design are view only — `editBlockOf` says why.
- Terms-as-a-separate-PDF and a one-page quote template are the NEXT step (new quotes only).
