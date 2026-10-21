# Expenses

Loaded when working in this folder. Also applies to `lib/expenses*.ts`, `lib/expense-*.ts`, `app/_v3/pages/expenses/`,
`app/_v3/ExpenseForms.tsx`, `app/_v3/dashboard/Spend.tsx` and `scripts/expense-*.mjs`.

## Expenses (added 21 Oct 2026)

What SY Creative Production spends, one row per payment: hotels, flights, transport, subscriptions, equipment, ads,
admin fees and other. Own sidebar group **Expenses** (v3): `/expenses` Overview (this year by kind, month and vendor,
trips, receipts to chase) and `/expenses/all` (add, filter, edit, receipts, month export). The v3 Dashboard has a
**Company spend** panel (`app/_v3/dashboard/Spend.tsx`) that ignores the filter bar. v1/v2 only get the nav link; the
pages draw inside a v3 frame there, like Facebook.
- **Table** `expense` (`supabase/expenses.sql`, run once, safe to repeat; the pages show the SQL until it exists). Not the
  `records` table: expenses need real columns (kind, vendor, reference, receipt state). `records` `cash_out` stays as it
  was (Vault / demo / bot's old brief) — expenses do NOT feed the bot's or the morning brief's cash-out figure yet.
- **Amount is RM actually paid.** A booking in another currency keeps `currency` + `original_amount` and its RM amount;
  RM is the only thing ever summed. `(vendor, reference)` is unique, so the same booking or order can't be filed twice —
  importers and scans rely on it (`upsert … onConflict vendor,reference`).
- **Maths** is `lib/expenses-math.ts` (tested in `tests/expenses.test.mjs`): totals, filters, run rate, CSV, file names.
  Nothing is stored; every figure is worked out each render. Subscription "running cost" = latest charge per plan
  (vendor + description), yearly ÷ 12, dropped when overdue (62 / 380 days).
- **Privacy:** `lib/expenses.ts` disguises `amount` and `original_amount` while amounts are hidden (same rule as
  Property). Saving, deleting and exporting need the owner AND "Show amounts" on (`moneyLocked`); attaching or waiving
  a receipt only needs a signed-in editor. Demo mode shows invented rows and refuses writes.
- **Receipts** live in Google Drive, filed like invoices (no model; Composio): `My Drive / 02 SY Creative / Expenses &
  Receipts / YYYY-MM / <date> - <vendor> - <what> - RM <amount>.<ext>`. The root folder is found or made once and kept in the
  `expense_export` setting. `expense.receipt` says where it stands: `filed` (file_id, url) / `uploading` / `failed` /
  `waived` ("no receipt needed"); no object = missing. Replacing a receipt uploads the new file first, then trashes the old
  one. Deleting an expense never deletes its Drive file. Upload limit 4 MB (Vercel body limit).
- **Month export** (`exportMonth`): a CSV of one month, receipt links included, filed beside that month's receipts; the
  last export per month is kept in the `expense_month_exports` setting and a re-export replaces the old CSV.
- **Filters** follow `docs/FILTER-BAR.md`: one sticky bar in the URL (`year`, `month`, `kind`, `receipt`, `trip`, `q`);
  opens on the current year. Charts follow `docs/CHARTS.md` (`data-tip`).
- **Real data is private** (repo is public): `.expense-data/` is git-ignored; hotel names, trips and amounts live only in
  Supabase. Never put real expenses in code, tests, comments or commit messages.
