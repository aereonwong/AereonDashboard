---
name: file-receipts
description: File company expense receipts (Gmail, Hotmail, vendor sites) into the Google Drive "To Process" folder and the Supabase `expense` table — naming, folder map, dedupe, PDF printing, scripts. Use when Aereon says "file receipts", "scan my email for receipts", "add these expenses", "chase missing receipts", or names a vendor's invoices to collect.
---

# File receipts

One logic for every mailbox. Each document = one PDF in Drive + one `expense` row.
Feature rules (table, privacy, maths): `app/(app)/expenses/CLAUDE.md` — read it first.
What is already filed and what is still open: memory `receipt-filing-logic` (private; never copy its
amounts, names or order numbers into the repo — the repo is public).

## 1. Find, don't file yet

- Gmail: `npm run expense:scan` (or a Gmail search via Composio). Hotmail: Composio
  `OUTLOOK_QUERY_EMAILS` (top 200, page_token, filter on receivedDateTime) — big results land in a file;
  classify subjects locally, then `OUTLOOK_GET_MESSAGE` only for the ones you keep.
- Search BOTH mailboxes and the Drive folder before filing, so nothing doubles up.
- New vendor or new kind of item → show Aereon the proposed names for that group first. Never batch-file
  a group whose names he hasn't seen.

## 2. Name

`YYYYMMDD - <Item> - <Vendor OrderID> - <Invoice|Receipt|Refund>.pdf` (`receiptFilename` in
`lib/expenses-math.ts` — use it, don't re-type the rule).
- Date = the document's own date, not the email date.
- Don't repeat the vendor if the item already starts with it.
- Same-day items must not clash: no order id → add start time + own-currency amount (`Uber Trip HK 0616 - HK$78.00`).
- Products: one file per product, from the "delivered" email.
- No RM amount in the name.

## 3. Folder (all under To Process — id in the `expense_export` setting)

Meta Verified monthly → `Meta` · every other Meta payment → `Ads Spend` · iCloud → `iCloud` ·
CapCut / Meitu / Snap / ManyChat / Envato → `App Subscriptions` · Google One → `Google Drive` ·
Adobe → `Adobe` · everything else (products, Uber, flights) → To Process itself.
List the folder's names first and skip any file already there.

## 4. Make the PDF

- Email has a PDF attachment → `npm run expense:receipts -- --vendor "<V>" --dry`, then without `--dry`
  (`--pick <regex>` picks the attachment, `--redo` replaces a filed one). Safe to run twice.
- Body IS the receipt → decode the `text/html` part, prepend subject/from/date, then headless Chrome:
  `--headless=new --no-pdf-header-footer --print-to-pdf`. Drive upload cap 5 MB — strip promo banners.
- Image-only PDF (some airline receipts) → OCR before reading figures (`markitdown <file>`).

## 5. Row in `expense`

- Unique key `(vendor, reference, doc_type)`; vendors spelled exactly ("Apple", "Meta", "Uber", "Google", "Adobe").
- `kind` ∈ hotel / flight / transport / subscription / equipment / ads / admin / other.
- Foreign currency: `currency` + `original_amount`; RM `amount` null or flagged `amount_estimated`.
  Never convert into RM totals.
- Refund = `doc_type` Refund with a POSITIVE amount (the maths makes it negative).
- App Store–bought Meta credit: Apple's charge is the cash-out; Meta's receipt is a zero-amount supporting row.
- `paid_with` stays empty. Personal items (games, VPN) are excluded.
- Bulk insert: every object needs identical keys. `npm run expense:import` skips existing rows itself.

## 6. Check and report

Count files per Drive folder and rows per vendor afterwards; tell Aereon what was filed, what was
skipped (already there) and what still needs him (missing months, OCR, items to confirm as company
spend). Update the private memory's "Done / Still open" lists.
