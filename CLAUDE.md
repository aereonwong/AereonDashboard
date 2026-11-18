# Aereon Dashboard

Personal business HQ for **Aereon Wong** — tech & travel content creator, drone pilot and
photographer in Kuala Lumpur (@aereonwong, ~53k followers; company SY Creative Production Sdn. Bhd.).
**Aereon Dashboard.** It began as the CashFlowOS AI Agents course template and has been heavily
customised since; older docs may still mention the template by its original name.

**Naming:** `AereonDashboard` (no space) is the system name — repo, config and identifiers. Where a
platform requires lowercase it is `aereondashboard` (the Vercel project, the npm package).
**Aereon Dashboard** (with a space) is the display name, for anything a person reads.

**Aereon have developer background.** Optimise the code and reasoning, execute the work when possible without keep asking instructions unless required — except for passwords and secret keys, which are always theirs to type.

## Live

- App: https://aereonwong.com (public pages: `/`, `/hello`, `/mediakit`, `/about`, `/contact`, `/privacy`;
  everything else behind sign-in). `www.` serves the same app. Domain at Cloudflare, DNS-only records to
  Vercel. The old `*.vercel.app` addresses were removed on 4 Oct 2026 and return 404.
- Repo: https://github.com/aereonwong/AereonDashboard (public, owner-only access; renamed from
  cashflowos-aereon — GitHub redirects the old URL)
- Hosting: Vercel project `aereondashboard` (Hobby) · Supabase project `cashflowos-aereon` (free,
  Singapore — its URL/ref never changes)
- Telegram bot: @aereon_cashflow_bot — answers only Aereon (owner id in env)
  **Paused since 16 Oct 2026** (Anthropic credits ran out): `/api/telegram` answers 200 and does nothing
  unless env `TELEGRAM_BOT=on` — set it in Vercel and redeploy to resume.

## Shape of the code

- Next.js 16 App Router, TypeScript, no CSS framework — one hand-written `app/globals.css`.
- `app/page.tsx` — public landing page (portrait, bio, live IG numbers, brand strip from invoices).
- `app/(app)/**` — everything behind sign-in; `app/(app)/layout.tsx` holds sidebar + bottom bar.
- Three app versions, one cookie (`cfo-dash`, set in Settings, read by `lib/v3/version.ts`): **v3**
  (Studio Standard — the default with no cookie, and the only one developed), `v2` (`_v2.tsx`,
  "Operating picture") and `v1` (`_v1.tsx`, "Creator view"). All read the same rows, so switching
  never changes a number.
- `proxy.ts` — the sign-in gate (Next 16 name for middleware). What is public is decided in code:
  `PUBLIC_EXACT` / `PUBLIC_PREFIX` / `PRIVATE_SEGMENTS` in `lib/agent-site.ts` (tested).
- `lib/records.ts` — every tab reads ONE Supabase `records` table; `meta` jsonb carries per-tab fields.
- `lib/invoices.ts` — invoice/client roll-ups. `lib/instagram.ts` — snapshots + analytics.
- `lib/analytics.ts` — everything Dashboard v2 states: rolling 12-month windows, client
  concentration, dormant clients, movers, seasonality, and the two classifiers (`service()` /
  `sector()`). Order matters in both classifiers — the comments say why. If a figure appears on v2,
  the function that produced it is in here; nothing on that page is estimated.
- `app/api/` — `telegram` (bot webhook), `cron-instagram`, `cron-daily` and `cron-news` (routes kept,
  unscheduled — see Scheduled), `instagram/refresh`, `track`, `demo` (password-guarded demo switch),
  `login`, `auth/google`.
- Charts are hand-built client components: `InteractiveBars`, `Donut`, `AreaChart`, `RowBars`.
  **Server components may not pass functions to them** — pass `unit`/`suffix` flags instead.

## Data conventions

- An invoice = a `cash_in` row with `meta.invoice_no`, status **`issued`** — or any unpaid row with
  `meta.payment_tracked: false` (196 Canva imports are `waiting` with tracking off) — = documented but
  payment not tracked yet. `issued` must never count as paid, owed or overdue — see `isIssued()` in
  `lib/records.ts`, honoured by the dashboard, Cash In, the morning brief and the bot's tools.
- Invoices were imported from Canva — the whole folder, Mar 2021 → Aug 2026: 185 invoices,
  RM 579,957.47 plus USD 10,130.30, SGD 7,378.40, RMB 4,000 and EUR 230, across 131 clients.
  Foreign-currency rows carry `meta.currency` and are never added into RM totals.
  `docs/INVOICE-AUDIT.md` lists what the source documents disagree about — read it before
  changing how invoices are parsed or before designing a new invoice template.
- Instagram: `ig_snapshots` + history/archive tables. Never raise the ~40-post media cap (50 silently
  returns zero). Reach / accounts_engaged are unique per window — never add windows together.
  "Typical post" = MEDIAN. Full rules: `docs/SOCIAL.md` (read before touching any social code).
- **Privacy mode** (`lib/privacy.ts`): real money is disguised ON THE SERVER for signed-in app requests unless
  the owner turned on "Show amounts". Any NEW loader that reads money must disguise it when `moneyHidden()`
  is true; any NEW fixed-money-band panel shows `.v3-locked` while hidden. Full rules: `docs/PRIVACY-MODE.md`.
- Demo mode: `cfo-demo` httpOnly cookie set by `/api/demo` after checking `DEMO_PASSCODE`. It swaps
  in `lib/demo-data.ts` for every tab. The bot and crons never see it (no cookie jar).

## Appearance

Liquid-glass theme with light/dark. Everything is switchable in Settings and stored per device:
7 basic palettes + 5 advanced ones (Solarin, Refire, Moon, Timber, iFly), 4 typefaces,
glass strength, and the background photo (two of Aereon's own KLCC shots, or plain colour).
Tokens live at the top of `globals.css`; attributes are `data-theme`, `data-accent`, `data-glass`,
`data-font`, `data-bg`, replayed before first paint by the script in `app/layout.tsx`.

## Scheduled

- **`cron-instagram` runs daily at 6:00am MYT** (`0 22 * * *` UTC) — the only cron. It only reads
  Instagram, the Facebook Page and TikTok through Composio and writes history rows; no Claude call, no message.
- **`cron-daily` is off** (8:30am job removed 27 Sep 2026; route kept). While it is off, neither the
  morning brief nor the scheduled-agent sweep (`overdueInvoiceCheck`, which proposes chasers for
  overdue invoices) runs. Restore: add its line back to `vercel.json`.
- **`cron-news` is off too** (9:00am MYT digest, 27 Sep 2026 — the costliest Claude call: Opus with
  web search). Restore: add `{ "path": "/api/cron-news", "schedule": "0 1 * * *" }` to `vercel.json`.
- Vercel Hobby fires crons within an hour of the stated time, and allows only 2 — one is free now.

## Dashboard v3 — the creator studio

A whole-app version chosen per device in Settings, beside v1 and v2. See `app/_v3/CLAUDE.md` for
its structure and design-system pointers. **One look since 3 Oct 2026: Studio Standard** (`canon`) —
Contact Sheet and Flight HUD were removed at Aereon's request. **Only v3 is developed**; v1 and v2
stay as they are (they must still build). Analytics or design changes cover Dashboard, Invoice
Summary, Invoice Details, Instagram and Clients together.

## Social — Instagram, Facebook, TikTok, /social (Oct 2026)

Pages `/instagram` (Content Lab), `/facebook`, `/tiktok`, `/social`; data via Composio (user `aereon`).
Platform registry `lib/v3/platforms.ts`; shared maths `buildSocial()` in `lib/v3/social-math.ts` (tested).
Hard rules: typical post = MEDIAN; never add unique-people figures (reach, viewers) across days, windows or
posts; combined figures add platforms, so in-app labels say someone on two counts twice. **Read `docs/SOCIAL.md`
before touching any social, Instagram, Facebook, TikTok or public-number code.**

**Every filtered page follows `docs/FILTER-BAR.md`** (one sticky bar, a scope chip on every panel).

**Every chart answers the mouse** (Aereon's rule, 17 Oct 2026): hover a mark → it lights up and a readout says what it is.
Server-drawn charts just add `data-tip="Heading\nfigure"` (shown by `app/_components/ChartTips.tsx`); client charts keep their
`.v3-tip`. Read `docs/CHARTS.md` before adding or changing any chart.

**Media kit v2** (`app/_v3/pages/MediaKit2.tsx` + `kit2.css`, 2 Oct 2026): audience-led kit with
the reach skyline and captioned brand wall, always drawn in Studio Standard. Chosen in Settings
beside v1; `/?preview=kit&kit=v2` previews it when signed in.

## Public proof numbers

Public pages show ONE overall figure per stat across every platform (`socialTotals()`, stored in
`social_totals` / `social_snapshots` after the cron). No platform names, no double-count notes (Aereon's call).
Details: `docs/SOCIAL.md`.

## Voice-over (19 Oct 2026)

`/voice` calls VoiceStudio on Aereon's Mac from the browser (nothing stored). Recipe + auto-check in
`lib/voice-recipe.ts`, shared with `~/Desktop/VoiceStudio/tools/check.py` — change both together.
Full rules: `docs/VOICE.md`; making a take: the `voice-over` skill.

## Site analytics + /mediakit deck (16–19 Oct 2026)

`/analytics/landing|link|mediakit` from `site_visits` via `/api/track` (no IP, bots filtered). `/mediakit`
is a static public deck in `public/mediakit/` (bump `KIT_UPDATED` in `lib/agent-site.ts` when it changes;
keep `KIT_SLIDES` in step). Private share-link brand names must never reach the public page.
Full rules: `docs/SITE-ANALYTICS.md`.

## Showcase (5 Oct 2026)

Landing page + media kits show one tile per kind of work (`lib/showcase.ts`, `npm run ig:archive`). Full rules: `docs/SHOWCASE.md` — read before touching the classifier or tiles.

## Property (own sidebar group since 4 Oct 2026)

Overview, loans, tenancy, costs, submeter — full rules in `app/(app)/property/CLAUDE.md` (read it before touching `lib/property*`, `lib/tenancy-math.ts`, `lib/submeter*` or `app/_v3/pages/property/`).
**Privacy (repo is public):** loan balances, property/bank names, spreads, tenant names, rents, fees and deposits live only in Supabase and `.property-data/` — never in code, comments or commit messages. `property_data_issue` fixes need Aereon's approval.

## Market research (18 Nov 2026)

Investor research on areas Aereon is researching — list.my
transactions + PropertyGuru asking prices → git-ignored `.market-data/`, Supabase `market_listing`. Apart from Property;
never feeds the Dashboard. Full rules: the `property-research` skill (read before touching `scripts/market/` or `lib/market-*`).

## Expenses (21 Oct 2026)

Company spending (hotels, flights, transport, subscriptions, equipment, ads, admin) with receipts filed in Google Drive — own
sidebar group, table `expense`, Dashboard "Company spend" panel. Full rules: `app/(app)/expenses/CLAUDE.md` (read before touching
`lib/expenses*`, `lib/expense-*`, `/expenses` or `scripts/expense-*.mjs`).

## Sign-in (Google + backup passcode, 4 Oct 2026)

Google OIDC (hand-written, `lib/google-auth.ts`) + `ADMIN_EMAILS` (break-glass) + `app_users` (Users page,
roles owner/admin/viewer; viewers read-only). Session cookie `cfo_session` signed with `AUTH_SECRET`.
Production with no secret fails CLOSED. Full rules: `docs/SIGN-IN.md` — read before touching auth.

## Quotations (10 Oct 2026)

`/invoices/quotes`. A quote is a `doc` row, status `quotation` — never income; the quote→invoice link lives on the INVOICE only (`meta.quotation_id`). Full rules: `app/(app)/invoices/quotes/CLAUDE.md`.

## Link page — /hello (11 Oct 2026)

Instagram bio link (`app/hello/`, public), edited on the `/links` tab, stored as one `records` row (`doc`/`setting`/`hello`). Full rules: `app/hello/CLAUDE.md` (read before touching `lib/hello*`, `lib/socials.ts`, `/links` or `/api/track`).

## Raising an invoice or a quotation

`/invoice` and `/quote` in Telegram — the interview flow, numbering rules, Canva template editing,
and the Google Drive export step. See the `raise-invoice` skill for the full detail.

## House rules

- Never print Aereon's passwords or keys into chat. Point at the file/line instead.
- `.env` is gitignored and holds the real secrets; the repo is public, so nothing secret goes in it —
  and no private business data either (real amounts, client-level findings, property, tenants, expenses).
- Never `git add -A` / `git add .`: other sessions share this folder. Stage files by name, and do
  branch work in its own worktree (`.claude/worktrees/<name>`).
- Never switch on something that spends every day (the bot, a cron) without Aereon's yes.
- The Telegram bot in group chats only answers when @mentioned, replied to, or sent a /command.
- **Merge without asking** (Aereon's standing instruction, 26 Sep 2026): once a change is done,
  open the pull request and merge it into `main` yourself — don't hand Aereon a merge button.
  Merging deploys the live app, so only merge after `npm run build` passes (for app code) and the
  pull request's checks are green. If a check fails, fix it first; if it can't be fixed, stop and
  explain instead of merging. The recipe is `/ship`.

**Done means** — say each of these in the final message, or say which one is missing and why:
1. Built (`npm run build`) and tested (`npm test`) for app code.
2. The affected page opened and checked, not assumed.
3. Reviewers run on the diff, every BLOCK fixed.
4. Merged, and live on aereonwong.com — with the PR link.

Last full audit: `docs/REVIEW-2026-10-30.md` — read it before auditing again (recipe: the `/audit` skill).

## Review agents (`.claude/agents/`)

Before opening a pull request, run the reviewers whose files the diff touches — in parallel — and
fix every BLOCK before merging. All are read-only; each opens with **Verdict: SHIP** or
**Verdict: BLOCK**, then findings with `file:line`. `/ship` has the full file-to-reviewer table.

- `numbers-guard` — money figures (`lib/records.ts`, `invoices.ts`, `analytics.ts`, `lib/v3/`, privacy mode, dashboard, Cash In, bot tools)
- `security-reviewer` — `proxy.ts`, `lib/agent-site.ts`, `app/api/**`, server actions, secrets, sign-in/demo, `vercel.json`, new routes
- `ig-guard` — Instagram fetch/refresh, snapshots, Media Kit, the public pages' live numbers
- `invoice-auditor` — invoice/quote numbering, parsing, editing, Canva/Drive export
- `build-verifier` — any app-code change: builds, starts locally, checks affected pages render
- `theme-qa` — CSS tokens, v3 CSS, charts, shared UI: screenshots every v3 accent / classic palette × light/dark

Project skills: `/ship` (build → review → PR → merge), `/audit` (whole-repo health check),
`file-receipts` (expense receipts to Drive + `expense` table), `raise-invoice`, `brand-deal` (enquiry →
quote → deposit → results report → paid; deal files in git-ignored `.deal-data/`).
Course-template commands (`.claude/commands/`): `/agent-builder`, `/jarvis-setup`, `/team-owner`,
`/team-crew`, `/team-deputy` — they need the bot on to be tested end to end.

## Tooling: motion, video, research

Motion skills, HyperFrames (HTML→MP4) and Agent Reach (web research) — what's installed and how: `docs/TOOLING.md`. Read the matching skill's `SKILL.md` before any animation, video or online research; honour `prefers-reduced-motion`.

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


# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
