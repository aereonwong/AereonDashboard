---
name: file-receipts
description: File company expense receipts (Gmail, Hotmail, vendor sites) into the Google Drive "To Process" folder and the Supabase `expense` table — naming, folder map, dedupe, PDF printing, scripts. Use when Aereon says "file receipts", "scan my email for receipts", "add these expenses", "chase missing receipts", or names a vendor's invoices to collect.
---

# File receipts

One logic for every mailbox: **each document = one PDF in Google Drive + one row in the `expense`
table.** Same name rule, same folders, same row shape whether it came from Gmail, Hotmail or a
vendor's billing page.

Read first, every time:

- `app/(app)/expenses/CLAUDE.md` — the feature's rules (table, privacy, maths).
- Memory `receipt-filing-logic` — the private facts: folder ids, which vendors and months are
  already filed, what is still open. **Never copy its amounts, names, order numbers or folder ids
  into the repo — the repo is public.**

## Never

- Never file a new vendor or a new kind of item before Aereon has seen the proposed names.
- Never file something that may be personal (games, VPN, household, a gift) — list it under
  "Needs you" instead. When unsure, it is unsure.
- Never convert a foreign amount into RM or add it to an RM total. Never invent an RM amount.
- Never put an RM amount in a file name.
- Never fill `paid_with` — payment method is not tracked.
- Never delete a Drive file or an `expense` row. Replacing a receipt = upload the new one first,
  then move the old to trash, only through `--redo`.
- Never type a mailbox or vendor password, or a 2FA code. If a billing page needs a login, stop
  and hand Aereon the page.
- Never open, download or forward an attachment that is not a receipt or invoice.
- Never run a script without `--dry` first when it has one.

## Steps

### 1. Find — don't file yet

1. **Scope.** From the request: which vendor(s), which period, which mailbox. No period given →
   from the last filed date in the memory's "Done" list to today.
2. **Gmail:** `npm run expense:scan` (or a Gmail search through Composio).
   **Hotmail:** Composio `OUTLOOK_QUERY_EMAILS` (top 200, `page_token`, filter on
   `receivedDateTime`) — big results land in a file; classify the subjects locally, then
   `OUTLOOK_GET_MESSAGE` only for the ones you keep.
3. **Search BOTH mailboxes and the Drive folder** before filing, so nothing doubles up. A vendor
   may bill one address and confirm to the other.
4. **Build the candidate table** (in chat, not in the repo):

   | Date | Item | Vendor · ref | Type | Amount | Folder | State |
   |---|---|---|---|---|---|---|
   | 2026-11-02 | Meta Verified | Meta · … | Receipt | RM … | Meta | new |
   | 2026-10-14 | Grab ride | Grab · … | Receipt | RM … | To Process | already in Drive |
   | 2026-10-20 | Water purifier | Shopee · … | Invoice | RM … | — | personal? ask |

5. **Gate.** Known vendor + known kind of item → carry on. New vendor, new kind, or a "personal?"
   row → show Aereon the table with the proposed file names and wait for a yes on those rows. File
   the rest meanwhile.

### 2. Name

`YYYYMMDD - <Item> - <Vendor OrderID> - <Invoice|Receipt|Refund>.pdf` — produced by
`receiptFilename` in `lib/expenses-math.ts`. **Call it; don't re-type the rule.**

- Date = the document's own date (order / invoice date), not the email date.
- Don't repeat the vendor if the item already starts with it.
- Same-day items must not clash: no order id → add start time + own-currency amount.
- Products: one file per product, from the "delivered" email.
- Type: `Invoice` = asks for payment or is a tax invoice · `Receipt` = confirms payment (default)
  · `Refund` = money back or a credit note.

Good names:

```
20261102 - Instagram Meta Verified - Meta 8842197730 - Receipt.pdf
20260616 - Uber Trip HK 0616 - HK$78.00 - Receipt.pdf
20250328 - Adobe Creative Cloud - AD0133270 - Refund.pdf
```

Bad names: `Receipt.pdf` · `Meta - Meta Verified - Meta 8842… .pdf` (vendor repeated) ·
`20261102 - Meta Verified RM41.99 - Receipt.pdf` (RM amount; no reference).

### 3. Folder

Everything lives under **To Process** (its id is the `expense_export` setting; sub-folder ids are
in the memory).

| What | Folder |
|---|---|
| Meta Verified monthly | `Meta` |
| Every other Meta payment (ads, ad-credit top-ups) | `Ads Spend` |
| iCloud | `iCloud` |
| CapCut, Meitu, Snap, ManyChat, Envato | `App Subscriptions` |
| Google One, Google AI storage plans | `Google Drive` |
| Adobe | `Adobe` |
| Everything else — products, Grab, Uber, flights, hotels | To Process itself |

List the target folder's file names first (`GOOGLEDRIVE_FIND_FILE`) and **skip any name already
there**. A vendor that does not fit the map → To Process itself, and say so in the report. (The
dashboard's own "attach receipt" button always uploads to To Process itself; the sub-folders are
this skill's sorting.)

### 4. Make the PDF

| The email has… | Do |
|---|---|
| A PDF attachment | `npm run expense:receipts -- --vendor "<V>" --dry`, read the plan, then run without `--dry`. `--pick <regex>` chooses among attachments, `--folder <id>` targets a sub-folder, `--redo` replaces a filed one. Safe to run twice. |
| No attachment — the body IS the receipt | Decode the `text/html` part, prepend a small header (subject, from, to, date), print with headless Chrome: `--headless=new --no-pdf-header-footer --print-to-pdf`. Composio's Drive upload cap is 5 MB — strip promo banners if over. |
| An image-only PDF (some airline receipts) | OCR before reading any figure: `markitdown <file>`. |
| Nothing — the receipt is on the vendor's billing page | Open the page in Aereon's Chrome; if it asks for a login, hand over. Save each document as PDF. |

Open at least one PDF per vendor batch and check it shows the vendor, the date, the reference and
the amount before uploading the rest.

### 5. Row in `expense`

| Column | Rule |
|---|---|
| unique key | `(vendor, reference, doc_type)` — the same booking can't be filed twice |
| `vendor` | Spelled exactly the same every time: "Apple", "Meta", "Uber", "Grab", "Google", "Adobe" |
| `reference` | The order / booking / invoice number as printed |
| `kind` | hotel · flight · transport · subscription · equipment · ads · admin · other |
| `amount` | RM actually paid. Foreign charge → `currency` + `original_amount`; RM `amount` null, or filled and flagged `amount_estimated` |
| `doc_type` | Invoice · Receipt · Refund. A Refund carries a **positive** amount — the maths makes it negative |
| `receipt` | `{ status: 'filed', file_id, url, name, … }` after the upload succeeds |
| `paid_with` | empty |

- App Store–bought Meta credit: Apple's charge is the cash-out; Meta's own receipt is a
  **zero-amount** supporting row.
- Bulk insert: every object needs identical keys. `npm run expense:import` skips existing rows
  itself (`--dry` first).

### 6. Check and report

1. Count files per Drive folder and rows per vendor; the new files and new rows must match one to one.
2. Spot-check one row on `/expenses/all` (figures are disguised unless Aereon has "Show amounts" on).
3. Update the private memory's "Done / Still open" lists.
4. Report in this shape:

```
Receipts filed — Meta + Grab, 1 Oct → 15 Nov 2026 (Gmail + Hotmail)

Filed (5): 5 PDFs in Drive, 5 new rows
- Meta → 2 Meta Verified receipts (Oct, Nov)
- Ads Spend → 1 ad top-up
- To Process → 2 Grab rides (12 Oct, 15 Oct)

Skipped (3): already in Drive — Meta Verified Sep, 2 Uber HK trips

Needs you (2):
- Shopee water purifier, 20 Oct — company or personal?
- Roaming wifi rental — email shows no price; need the card statement line

Missing: no Meta Verified receipt for August in either mailbox (a skipped billing month is normal).
Checks: 5 files = 5 rows · opened 1 PDF per vendor · memory updated
```

Amounts may appear in this chat report (it is private) but never in the repo, a commit message
or a PR.
