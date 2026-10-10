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

- App: https://aereonwong.com (public landing at `/`, everything else behind a passcode). Domain bought
  at Cloudflare on 4 Oct 2026; DNS-only records (A 216.198.79.1 + 64.29.17.1, www CNAME to Vercel).
  `www.aereonwong.com` serves the same app. The old `aereonwong.vercel.app` and
  `cashflowos-aereon.vercel.app` were removed from the project on 4 Oct 2026 and now return 404; the
  Telegram webhook was re-pointed to `https://aereonwong.com/api/telegram` first.
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
  renders `_v2.tsx` ("Operating picture") or `_v1.tsx` ("Creator view") — but since 2 Oct 2026 the app defaults to **v3** (Studio Standard) when no cookie is set; see `lib/v3/version.ts`. Settings sets the
  cookie. Both read the same rows, so switching never changes a number.
- `proxy.ts` — the passcode gate (Next 16 name for middleware). Public paths are listed in its matcher.
- `lib/records.ts` — every tab reads ONE Supabase `records` table; `meta` jsonb carries per-tab fields.
- `lib/invoices.ts` — invoice/client roll-ups. `lib/instagram.ts` — snapshots + analytics.
- `lib/analytics.ts` — everything Dashboard v2 states: rolling 12-month windows, client
  concentration, dormant clients, movers, seasonality, and the two classifiers (`service()` /
  `sector()`). Order matters in both classifiers — the comments say why. If a figure appears on v2,
  the function that produced it is in here; nothing on that page is estimated.
- `app/api/` — `telegram` (bot webhook), `cron-daily` (unscheduled since 27 Sep 2026; route kept), `cron-news` (9am digest, unscheduled since 27 Sep 2026; route kept),
  `instagram/refresh`, `demo` (password-guarded demo switch), `login`.
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
- Instagram lives in its own `ig_snapshots` table, one row per refresh. Instagram caps a media page
  at ~40 posts for this field set — asking for 50 silently returns zero, so never raise the cap.
  History (added 2 Oct 2026, `supabase/instagram-history.sql`): `ig_post_metrics`,
  `ig_account_snapshots`, `ig_account_daily`. Fetching lives in `lib/ig-fetch.ts` — no runtime
  imports, so `scripts/ig-refresh.mjs` loads the same file. Insight metrics differ per format
  (Reels: watch time; posts: follows, profile visits) — asking for an unsupported one fails the call.
  **Archive (7 Oct 2026, `supabase/instagram-archive.sql`, `npm run ig:backfill`):** every post ever
  (`ig_posts`) with insights in `ig_post_metrics`, account totals per 30-day window back to Oct 2024
  (`ig_account_periods`) and daily reach back as far (`ig_account_daily`). For analytics, read these
  tables first; only ask Instagram again when a refresh is actually needed. Reach and accounts_engaged
  are unique per window — never add windows' reach together.
  "Typical post" means the MEDIAN reach (`analyse()` in `lib/instagram.ts`), never the mean.
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
  Instagram through Composio and writes history rows; no Claude call, no message.
- **`cron-daily` is no longer scheduled** — Aereon removed the 8:30am job on 27 Sep 2026. The
  route (`app/api/cron-daily`) is kept, so adding its line back to `vercel.json` restores it. While
  it is off, neither the morning brief nor the scheduled-agent sweep (`overdueInvoiceCheck`, which
  proposes chasers for overdue invoices) runs.
- **`cron-news` is paused too** — Aereon turned off the 9:00am MYT news digest on 27 Sep 2026
  (it had been failing on a low Anthropic credit balance, and it was the costliest Claude call:
  Opus with web search). To restore it, add
  `{ "path": "/api/cron-news", "schedule": "0 1 * * *" }` back to restore it.
- Vercel Hobby fires crons within an hour of the stated time, and allows only 2 — one is free now.

## Dashboard v3 — the creator studio

A whole-app version chosen per device in Settings, beside v1 and v2. See `app/_v3/CLAUDE.md` for
its structure and design-system pointers. **One look since 3 Oct 2026: Studio Standard** (`canon`) —
Contact Sheet and Flight HUD were removed at Aereon's request. **Only v3 is developed**; v1 and v2
stay as they are (they must still build). Analytics or design changes cover Dashboard, Invoice
Summary, Invoice Details, Instagram and Clients together.

**Instagram Content Lab** (10 Oct 2026, `app/_v3/pages/ContentLab.tsx` + `lab.css`, maths in `lib/v3/lab-math.ts`,
read in `lib/v3/content-lab.ts`): the second view of the v3 Instagram page, chosen per device in Settings
(cookie `cfo-ig=lab`; default `studio`). Reads THIS YEAR's posts only (from 1 Jan, Malaysia time — Aereon's
call) with each post's latest `ig_post_metrics` reading, and filters them in the browser: one sticky bar for
timeline (opens on the last 90 days — or the year so far when that is shorter; also year / 30 days / a month, or click a bar), format, angle, hook. Only "Reach over time" keeps the whole year, as context, with the slice highlighted. Hook = the caption's first line,
classified by `HOOKS` (first match wins); angle by `angleOf`; brand placement by `brandOf`. Each panel names the
filters it ignores. Typical = median; hit = 2× the slice's typical. Empty in demo mode.

**Media kit v2** (`app/_v3/pages/MediaKit2.tsx` + `kit2.css`, 2 Oct 2026): audience-led kit with
the reach skyline and captioned brand wall, always drawn in Studio Standard. Chosen in Settings
beside v1; `/?preview=kit&kit=v2` previews it when signed in.

## Showcase — work across the board (added 5 Oct 2026)

The landing page and both media kits show a spread of Aereon's work, not just the recent feed (lately
mostly KLCC). `npm run ig:archive` (Composio CLI, like `ig:refresh`) lists two years of posts, gets each
one's reach, and `lib/showcase.ts` picks one tile per kind: product review, event, car review, hotel
review, aerial (drone flying or from above; a drone show stays an event), travel in Singapore / Bali / Brunei / Malaysia / abroad — KLCC at most once.
Tiles are **blended** (strongest, weakest, next strongest…) and reach is printed only on tiles at or
above the two-year median; weaker ones show their label alone. Output: `lib/showcase.json` + covers in
`public/img/work/` (saved locally — Instagram image URLs expire). Not refreshed by the cron; re-run the
script when new work should be able to make it. Classifier rules are order-sensitive; comments say why.

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

## Sign-in (Google + backup passcode, added 4 Oct 2026)

Front door is **Sign in with Google** (`lib/google-auth.ts`, `app/api/auth/google/**`: OIDC code flow +
PKCE, hand-written, no auth library). Active only when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set;
until then the login page is the old passcode form. A verified Google account must also be allowed:
- `ADMIN_EMAILS` (env, comma-separated) — always in, needs no database. This is the break-glass list:
  keep a second Google account on it.
- `app_users` table (`supabase/app-users.sql`) — the managed list, edited on the **Users** page (`/users`,
  `app/(app)/users/`): role owner/admin/viewer, `active` (Lock), `last_login_at`. Owner manages everyone; admin
  manages viewers only; nobody edits their own row; ADMIN_EMAILS people show read-only (role owner). Roles gate
  only the Users page so far — a viewer can still use every other tab and server action (not read-only yet).
- Session cookie `cfo_session` = `exp.nonce.who.sig`; `who` = `pw` (passcode) or the Google email.
  Signed with `AUTH_SECRET` (falls back to `APP_PASSCODE`). Rotating it signs everyone out. `signedIn()`
  (lib/auth.ts, used by the (app) layout and every server action) re-checks a Google account against the list,
  so Lock/Remove cuts someone off on their next click. The proxy only checks the cookie signature.
- Backup access ladder: second Google account → passcode (`APP_PASSCODE`, behind "Use backup passcode") →
  edit env vars in Vercel. `PASSCODE_LOGIN=off` retires the passcode and invalidates its sessions.
  Once `AUTH_SECRET` is set, rotating `APP_PASSCODE` no longer kills existing passcode sessions — rotate
  `AUTH_SECRET` or set `PASSCODE_LOGIN=off` instead.
- Google redirects only to one host (`APP_BASE_URL`, default https://aereonwong.com), registered in
  Google Cloud. `/api/logout` (POST) clears the cookie; Sign out is in the v3 rail, the classic sidebar and Settings → Account.
  The login page (`app/login/`) is Studio Standard: KLCC photo beside the form, passcode folded under the Google button.

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

## Raising an invoice or a quotation

`/invoice` and `/quote` in Telegram — the interview flow, numbering rules, Canva template editing,
and the Google Drive export step. See the `raise-invoice` skill for the full detail.

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

## Review agents (`.claude/agents/`)

Before opening a pull request, run the reviewers whose files the diff touches — in parallel, and
fix every BLOCK before merging:

- `numbers-guard` — money figures (`lib/records.ts`, `invoices.ts`, `analytics.ts`, `lib/v3/`, dashboard, Cash In, bot tools)
- `security-reviewer` — `proxy.ts`, `app/api/**`, secrets, login/demo, `vercel.json`, new routes
- `ig-guard` — Instagram fetch/refresh, snapshots, Media Kit, the landing page's live numbers
- `invoice-auditor` — invoice/quote numbering, parsing, editing, Canva/Drive export
- `build-verifier` — any app-code change: builds, starts locally, checks affected pages render
- `theme-qa` — CSS tokens, v3 CSS, charts, shared UI: screenshots every palette × light/dark

Each opens with **Verdict: SHIP** or **Verdict: BLOCK**. All are read-only.

## Motion skills (installed 2 Oct 2026)

From https://github.com/kevinbadi/claude-motion-skills (an index of 16 packs by iart.ai, MIT).
Two packs copied into `.claude/skills/` — load on new chat start:

- **Web motion** (`iart-ai/web-animation-skills`): `gsap-web`, `micro-interaction`,
  `accessible-animation`, `svg-animation`, `lottie-animation`, `page-transition-animation`,
  `glassmorphism`, `ascii-animation`, `60fps-animation`.
- **Motion design** (`iart-ai/motion-design-skills`): `animation-principles`, `motion-art-direction`,
  `motion-background`, `color-motion`, `logo-animation`, `shot-composition`, `remotion-video`,
  `beat-sync-editing`, `after-effects`.

**Use them when implementing any animation, transition, hover/scroll effect or video in the app.**
Read the matching `SKILL.md` first, honour `prefers-reduced-motion` (`accessible-animation`), keep
animation to `transform`/`opacity` (`60fps-animation`), and follow the skill's render → screenshot →
check loop before claiming it works.

Ten more packs installed for content/video work (not dashboard UI) — read the matching `SKILL.md` first:

- **Short-form / YouTube:** `short-form-video`, `caption-animation`, `countdown-video`, `lower-thirds`,
  `audiogram`, `youtube-intro-outro`.
- **Ads / products:** `ad-creative-video`, `launch-video`, `testimonial-video`, `promo-video`,
  `product-demo-video`, `photo-slideshow`.
- **Data / explainers:** `chart-animation`, `animated-infographic`, `presentation-video`,
  `explainer-video`, `diagram-animation`, `isometric-animation`, `whiteboard-animation`, `wrapped-video`.
- **Maps / type / 3D:** `map-animation` (travel routes), `kinetic-typography`, `threejs-animation`,
  `shader-glsl`, `particle-system`.
- **Client work (SY Creative):** `creative-brief`, `brand-motion-guidelines`, `client-revisions`,
  `motion-pricing`, `video-delivery-specs`.

Skipped as niche: `text-message-video-skills`, `manim-skills`, `generative-illustration-skills`,
`javascript-animation-skills` — add with `npx skills add iart-ai/<pack-name>`.

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

## HyperFrames — HTML to MP4 video (installed 2 Oct 2026)

From https://github.com/heygen-com/hyperframes (HeyGen, Apache 2.0). Write HTML/CSS/GSAP, render
deterministic MP4. Installed as a user-scope Claude Code plugin (needs Node >= 22; this Mac has 24).

Install on a fresh machine or cloud session:

```bash
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
```

Use `/hyperframes:hyperframes` first — it routes to the right workflow (`product-launch-video`,
`motion-graphics`, `short-form` etc). Standalone skills alternative: `npx hyperframes skills update`.
Use it for any video/animation render in the app; follow render → preview → check before claiming done.

## Agent Reach — internet access for research (installed 2 Oct 2026)

From https://github.com/Panniantong/agent-reach (MIT). Reads web pages, YouTube, RSS, V2EX, Bilibili,
GitHub, plus Reddit/Facebook/Instagram/Twitter/LinkedIn once logged in. Skill is at
`~/.claude/skills/agent-reach`.

**Use it automatically** when Aereon asks to research, search or look something up online, or shares
a URL or names a platform (YouTube, Reddit, Instagram, X, Bilibili, LinkedIn, GitHub, RSS) — before
guessing or using plain WebFetch. Run `agent-reach doctor` to see which channels work right now.

Install on a fresh machine (python 3.10+ via uv; npm global folder must be user-writable):

```bash
uv tool install --python 3.12 https://github.com/Panniantong/agent-reach/archive/main.zip
agent-reach install --env=auto --system --channels=opencli
npm install -g --allow-scripts=@jackwener/opencli @jackwener/opencli mcporter
mcporter config add exa https://mcp.exa.ai/mcp --scope home
uv tool install "yt-dlp[default]"
```

OpenCLI (`opencli`) needs its Chrome "Browser Bridge" extension loaded (chrome://extensions →
Developer Mode → Load unpacked, from github.com/jackwener/opencli/releases) and Chrome logged in to
the site. Not connected yet as of 2 Oct 2026. Cookies/logins are Aereon's to provide — never type them.
