# Aereon Dashboard

Personal business HQ for **Aereon Wong** — tech & travel content creator, drone pilot and
photographer in Kuala Lumpur (@aereonwong, ~53k followers; company SY Creative Production Sdn. Bhd.).
**Aereon Dashboard.** It began as the CashFlowOS AI Agents course template and has been heavily
customised since; older docs may still mention the template by its original name.

**Naming:** `AereonDashboard` (no space) is the system name — repo, config and identifiers. Where a
platform requires lowercase it is `aereondashboard` (the Vercel project, the npm package).
**Aereon Dashboard** (with a space) is the display name, for anything a person reads.

**Aereon is not a developer.** Explain in plain words, avoid jargon, do the work rather than
handing over instructions — except for passwords and secret keys, which are always theirs to type.

## Live

- App: https://aereonwong.vercel.app (public landing at `/`, everything else behind a passcode).
  The original https://cashflowos-aereon.vercel.app still points at the same project and is kept on
  purpose: the Telegram webhook is registered against it. Remove it only after re-pointing the webhook.
- Repo: https://github.com/aereonwong/AereonDashboard (public, owner-only access; renamed from
  cashflowos-aereon on 26 Sep 2026 — GitHub redirects the old URL)
- Hosting: Vercel project `aereondashboard` (Hobby; renamed from cashflowos-aereon, same project ID)
  · Supabase project `cashflowos-aereon` (free, Singapore — its URL/ref never changes)
- Telegram bot: @aereon_cashflow_bot — answers only Aereon (owner id in env)

## Shape of the code

- Next.js 16 App Router, TypeScript, no CSS framework — one hand-written `app/globals.css`.
- `app/page.tsx` — public landing page (portrait, bio, live IG numbers, brand strip from invoices).
- `app/(app)/**` — everything behind the passcode; `app/(app)/layout.tsx` holds sidebar + bottom bar.
- The Dashboard has two layouts. `app/(app)/dashboard/page.tsx` reads the `cfo-dash` cookie and
  renders `_v2.tsx` (default, "Operating picture") or `_v1.tsx` ("Creator view"). Settings sets the
  cookie. Both read the same rows, so switching never changes a number.
- `proxy.ts` — the passcode gate (Next 16 name for middleware). Public paths are listed in its matcher.
- `lib/records.ts` — every tab reads ONE Supabase `records` table; `meta` jsonb carries per-tab fields.
- `lib/invoices.ts` — invoice/client roll-ups. `lib/instagram.ts` — snapshots + analytics.
- `lib/analytics.ts` — everything Dashboard v2 states: rolling 12-month windows, client
  concentration, dormant clients, movers, seasonality, and the two classifiers (`service()` /
  `sector()`). Order matters in both classifiers — the comments say why. If a figure appears on v2,
  the function that produced it is in here; nothing on that page is estimated.
- `app/api/` — `telegram` (bot webhook), `cron-daily` (agent sweep; brief disabled), `cron-news` (9am digest),
  `instagram/refresh`, `demo` (password-guarded demo switch), `login`.
- Charts are hand-built client components: `InteractiveBars`, `Donut`, `AreaChart`, `RowBars`.
  **Server components may not pass functions to them** — pass `unit`/`suffix` flags instead.

## Data conventions

- An invoice = a `cash_in` row with `meta.invoice_no`, status **`issued`** = documented but payment
  not tracked yet. `issued` must never count as paid, owed or overdue — see `isIssued()` in
  `lib/records.ts`, honoured by the dashboard, Cash In, the morning brief and the bot's tools.
- Invoices were imported from Canva — the whole folder, Mar 2021 → Aug 2026: 185 invoices,
  RM 579,957.47 plus USD 10,130.30, SGD 7,378.40, RMB 4,000 and EUR 230, across 131 clients.
  Foreign-currency rows carry `meta.currency` and are never added into RM totals.
  `docs/INVOICE-AUDIT.md` lists what the source documents disagree about — read it before
  changing how invoices are parsed or before designing a new invoice template.
- Instagram lives in its own `ig_snapshots` table, one row per refresh. Instagram caps a media page
  at ~40 posts for this field set — asking for 50 silently returns zero, so never raise the cap.
- Demo mode: `cfo-demo` httpOnly cookie set by `/api/demo` after checking `DEMO_PASSCODE`. It swaps
  in `lib/demo-data.ts` for every tab. The bot and crons never see it (no cookie jar).

## Appearance

Liquid-glass theme with light/dark. Everything is switchable in Settings and stored per device:
7 basic palettes + 5 advanced ones (Solarin, Refire, Moon, Timber, iFly), 4 typefaces,
glass strength, and the background photo (two of Aereon's own KLCC shots, or plain colour).
Tokens live at the top of `globals.css`; attributes are `data-theme`, `data-accent`, `data-glass`,
`data-font`, `data-bg`, replayed before first paint by the script in `app/layout.tsx`.

## Scheduled

- 8:30am MYT — `cron-daily`. The **morning brief is OFF** (Aereon turned it off on 22 Sep 2026;
  `MORNING_BRIEF_ENABLED` in the route flips it back). The cron still runs, because the same job
  sweeps the scheduled agents and creates proposals — that part is deliberately still on.
- 9:00am MYT — tech & travel news digest via Claude web search, owner only
- Vercel Hobby fires crons within an hour of the stated time, and allows only 2 — both are used.

## Dashboard v3 — the creator studio

A whole-app version chosen per device in Settings (cookies `cfo-dash=v3`, `cfo-v3=contact|hud|canon`)
beside v1 and v2. One shared structure (`app/_v3/`, `lib/v3/`) in three visual worlds. Its design
system is recorded in **DESIGN.md** and `.impeccable/design.json` — read those before changing any v3
UI; the per-world rules there (Flight HUD colour is status-only, Contact Sheet's ground is neutral film
black, circles are sized explicitly) are load-bearing. `PRODUCT.md` holds the product truths it answers
to. The public media kit is switched on site-wide in Settings; `/?preview=kit` previews it when signed in.

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

## House rules

- Never print Aereon's passwords or keys into chat. Point at the file/line instead.
- `.env` is gitignored and holds the real secrets; the repo is public, so nothing secret goes in it.
- Verify before claiming: build locally (`npm run build`), and check a page actually renders.
- The Telegram bot in group chats only answers when @mentioned, replied to, or sent a /command.
- **Merge without asking** (Aereon's standing instruction, 26 Sep 2026): once a change is done,
  open the pull request and merge it into `main` yourself — don't hand Aereon a merge button.
  Merging deploys the live app, so only merge after `npm run build` passes (for app code) and the
  pull request's checks are green. If a check fails, fix it first; if it can't be fixed, stop and
  explain instead of merging.

## Reading documents

`markitdown <file>` converts PDF, Word, Excel, PowerPoint, CSV, HTML and images into Markdown.
Use it when Aereon hands over a brief, contract, rate card or invoice file, instead of guessing at
the contents. Cloud sessions install it at startup (`.claude/hooks/session-start.sh`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Folder move (27 Sep 2026)
The project folder was renamed from `~/cashflowos-aereon` to `~/AereonDashboard`. A symlink at the old path
still points here so old references keep working; it can be deleted once nothing uses it.
