# Property section

Loaded when working in this folder. Also applies to `lib/property*`, `lib/tenancy-math.ts`, `lib/submeter*` and `app/_v3/pages/property/`.

## Property section (own sidebar group since 4 Oct 2026)

Property is its own section, apart from the studio Dashboard — nothing property-related feeds it. v3 sidebar
group **Property**: `/property` Overview (one card per property; the future property dashboard grows here),
`/property/loans`, `/property/tenancy`, `/property/costs`. Pages live in `app/(app)/property/**`, v3 UI in
`app/_v3/pages/property/` (loader `app/(app)/property/_load.ts`); v1/v2 only keep the one-table view at `/property`.
- **Tenancy** (`supabase/tenancy.sql`, `lib/tenancy-math.ts`): `property_tenancy` is one row per term; terms with the
  same `tenant_name` form one tenant group (original + extensions). A tenant's score = rent due so far less bills tagged
  to them (`property_cost.tenant_name`). Deposits are columns on the original term (advance rent, security, utility,
  access cards). Renaming a tenant (`renameTenant`) changes every term and tagged bill. Rent due is computed, never stored.
- **Recovered from deposit**: a bill tagged to a tenant can be ticked `recovered_from_deposit` — the owner paid it but it was
  deducted from the tenant's deposit, so it is NOT a cost (excluded from `costTotals`, tenant net and estimate). The tenant card
  shows the deposit settlement (held − deducted = due back; `deposit_refunded` = actually paid back; the difference is kept).
- **Dual key** (a property with two tenants at once, e.g. main unit + studio): each unit is simply its own tenant name; there is no unit column.
  `cashResult(..., all)` splits the one loan instalment and one maintenance fee between concurrent tenants by rent share, and Overview adds
  the live tenants together (`propertyMonthly`), so nothing is counted twice. Single-tenant properties are unchanged.
- **Costs**: `property_cost`, kinds maintenance_fee / repair / agent_fee / stamping_fee / other; one row per bill,
  listed ten to a page. Monthly maintenance is entered as one row per month (no recurring rule yet).
- Run `supabase/tenancy.sql` once (safe to repeat); the Tenancy and Costs pages ask for it until the columns exist.
  Tenancy terms load with `npm run property:import -- --tenancy` (from `.property-data/tenancies.json`, replaces all terms).
- Same privacy rule as the loans: tenant names, rents, fees and deposits live only in Supabase and `.property-data/`.

## Property tab — home loans (added 4 Oct 2026)

`/property` replaces the "Interest Rate" Numbers sheet (Dropbox/Personal/Property) for Aereon's home loans.
Which properties, banks and spreads they are is private: see `.property-data/loans.json` (git-ignored).
- Tables in `supabase/property.sql` (`property_loan`, `property_loan_month`, `property_bank_rate`,
  `property_data_issue`). Only raw inputs are stored; all maths is `lib/property-math.ts`.
- **Monthly job: one figure**, the outstanding balance from the statement, typed on the page. Saving
  marks it `statement` and opens next month as `pending` with the instalment carried over.
- The rate is never typed. It is the bank's published BR on each day of the period + the loan's spread.
  When a bank changes its rate, add a row to `property_bank_rate` (and `.property-data/bank_rates.json`).
- A row dated month M pays interest for the period ending on M's instalment day (`cycle_day`), which the
  bank figures prove to the sen. Both loans' instalment days are confirmed by Aereon (in loans.json).
- Everything about the loans is private: it lives in Supabase and `.property-data/` (git-ignored), loaded
  by `npm run property:import` (`-- --dry` works it out offline). The repo is public: never commit
  balances, property or bank names, or spreads, not even in comments or commit messages.
- `property_data_issue` holds what the spreadsheet move found. Aereon approves each fix; don't apply
  open ones without asking.
