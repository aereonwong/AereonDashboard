# Cash flow (bank statements)

Loaded when working in this folder. Also applies to `lib/bank*.ts`, `app/_v3/pages/CashFlow.tsx`,
`app/_v3/dashboard/Bank.tsx`, `app/_v3/cashflow.css`, `scripts/bank-statements.mjs`, `scripts/pdf-words.swift`
and `supabase/bank.sql`.

## What it is (added 18 Nov 2026)

The company's Hong Leong current account, line by line, beside what was invoiced. **Revenue** = invoiced, on the
invoice date (lib/invoices.ts). **Cash in** = what landed in the bank, on the day it landed. They are never mixed.
Page `/invoices/cash-flow` (sidebar: Cash flow, under Quotations) and the Dashboard panel **Cash in the bank**.
**Money out** = every withdrawal, on the day it left (salary, claims, statutory, suppliers…). The page shows money in /
money out / net / balance for the year, a monthly in-vs-out chart, money out by kind and every payment out this year;
the Dashboard panel carries money out + net. Net = all money in − all money out (`totals.net`, worked out in `lib/bank.ts`).

**Date filter (19 Nov 2026):** the page uses the Invoice Summary bar (`FilterBar`, `parseFilters`, opens on this year).
`readCashFlow({ from, to })` works `totals`, `outKinds`, `chart`, `periodBalance` and `median` out over that period
(start clipped to the first statement); with no period (the Dashboard panel) it means this calendar year. The to-do
panels (paid says the bank, waiting, unmatched deposits) and "Still to collect" ignore the dates — they are what is
open now — and say so in their chip. Under the in/out bars a **net strip** shows each month above (status green) or
below (status red) a zero line. Clicking a kind under Money out adds `?out=<kind>` (checked against `OUT_KINDS`)
and narrows Payments out to that kind.

## Where the data comes from

- The accountant's Drive folder "Bank Statement" → `Monthly Statement` (Dec 2023 on, named `Oct26.pdf` etc.) and
  `Daily statement` (Oct 2022 – Aug 2023). Folder ids are in `.env` `BANK_DRIVE_FOLDERS` (comma-separated), never in the repo.
- `npm run bank:fetch` downloads new PDFs into git-ignored `.bank-data/pdf/` (Composio Drive).
- `npm run bank:parse` reads every PDF with `scripts/pdf-words.swift` (PDFKit, keeps each line's position — the
  Deposit / Withdrawal / Balance columns are told apart by where the figure ENDS on the page) and **checks every
  statement adds up**: opening + deposits − withdrawals = each printed balance, the bank's totals and the closing
  balance. One cent off → it says which line and refuses to upload. `-- --upload` upserts into `bank_statement` and
  `bank_txn` (safe to repeat; never overwrites the owner's `kind` / `invoice_ids`).
- Known gaps in the folder (Nov 2026): Aug–Nov 2023 and Jan 2024 statements are missing. The page lists missing
  months and shows no balance for them — never zero.

## Matching deposits to invoices (`matchDeposits`, tested in tests/bank.test.mjs)

Strongest first: (1) the owner's pick on the page (`bank_txn.invoice_ids`; `{}` = not an invoice); (2) an invoice
or quotation number in the payer's reference, however typed (`refsIn`); (3) payer looks like the client
(`sameParty`, the note counts — agencies name the client there) AND the amount is the invoice's full amount or
exactly what is still owed, 14 days before to a year after the invoice; (4) a note saying deposit / balance / % on
the only open invoice of that client counts as part payment. Foreign-currency invoices match by reference only.
One matched deposit settles a foreign-currency invoice in full (RM can't be compared with USD), unless a deposit's
note says deposit / balance / % — then it stays part-paid for the owner to confirm.
Nothing is written by matching. **"Mark paid on their bank dates"** (`confirmFromBank`) writes `status: paid` +
`meta.paid_on` = the bank date, `payment_ref: 'bank statement'` — undo is the usual Mark unpaid.

## Rules

- **Private (repo is public):** statements, amounts, payer names and balances live only in Supabase and
  `.bank-data/`. Never in code, tests, comments or commit messages. Tests use invented names.
- **Privacy mode:** `lib/bank.ts` works everything out on the REAL figures (matching compares to the cent), then
  disguises the finished view (`disguise`) while amounts are hidden. Any new money field in `CashFlow` must be
  added to `disguise`.
- **Tracking off (`issued`) is never owed:** an issued invoice with no deposit is left out of Waiting and "Still to
  collect" and only counted (`untracked`). A deposit found for it still shows it as paid per bank, to confirm.
- "Still to collect" adds RM invoices only; `owed.count` counts those, `owed.foreign` the others.
- Actions re-read everything server-side; viewers and demo mode cannot write; they need the owner with amounts
  showing (`moneyLocked`), and the page hides the buttons otherwise. None changes an amount.
- **Payee rules (19 Nov 2026):** the kind picker's "all to this payee" tick saves `out:<PAYEE>` / `in:<PAYEE>` → kind in
  one records row (`doc` / `setting` / title `bank-kinds`, `meta.rules`). Every line of that payee and direction, past and
  future statements, takes it unless the line has its own kind (`applyPayeeRules`, tested). Payee names stay in that
  row — never add a person's or supplier's name to `flowKind`'s patterns (public repo); public bodies (KWSP, PERKESO,
  LHDN) are fine there.
- Kinds (`flowKind`): client, from director, interest, refund · salary, claims, EPF/SOCSO/tax, accountant & audit,
  bank charges, rent & utilities, crew & suppliers. Director transfers = salary/claims/capital, never trade.
- **Before shipping:** `npm test`, open `/invoices/cash-flow` and `/dashboard` with amounts hidden and shown,
  `numbers-guard`, `security-reviewer` (actions), `theme-qa` (chart/CSS).
