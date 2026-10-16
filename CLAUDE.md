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
- **Privacy mode — money is hidden by default, on the SERVER** (13–16 Oct 2026, `lib/privacy.ts`): while hidden,
  `getRecords()`, `readProperty()`, `readSubmeter()` and the paid-reach read return every amount as 0 (and money in
  free text blanked), so no real figure reaches the browser — not in the HTML, not in DevTools. Only signed-in app
  requests are gated: `proxy.ts` adds the `x-cfo-money: gate` header; the bot, the crons and public pages never carry
  it and always read real figures. "Show amounts" sets cookie `cfo-reveal` (expiry ms, pushed forward by activity,
  5 min idle) and reloads. Money-saving actions (invoice/quote save & edit, property, sub-meter) and the invoice PDF
  routes refuse while hidden, because a form drawn while hidden holds zeros. On screen, `MoneyMask.tsx` draws the
  zeros as `RM *****` (a bare money number needs `data-money`; `data-money-off` exempts), a click on any figure or on a
  `data-money-edit` control shows amounts, and `PrivacyNote.tsx` explains on money pages that value-based charts and
  rankings are blank while hidden. Any NEW loader that reads money must zero it when `moneyHidden()` is true.
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
  Instagram and the Facebook Page through Composio and writes history rows; no Claude call, no message.
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

## Facebook — the Aereon Wong Page (added 12 Oct 2026)

`/facebook` (v3 Social group beside Instagram; classic layouts get the same page in a v3 frame) and a combined
Instagram + Facebook band on the v3 Dashboard ("Is my audience growing"; the top KPI becomes "Social reach").
- Connection: Composio project auth config `facebook-dashboard`, user `aereon` (OAuth done by Aereon 12 Oct 2026).
  Page id `835556219912496` (public; `FB_PAGE_ID` overrides). The connection can also see "Discover Kuala Lumpur" — not used.
- Tables (`supabase/facebook.sql`): `fb_page_daily` (one row per day: followers, follows, unfollows, views, viewers,
  engagements, video views — back to Aug 2024 for views), `fb_page_periods` (rolling 28-day totals per day, Facebook's
  own unique count), `fb_posts`, `fb_post_metrics` (+ view `fb_post_latest`).
- Meta retired impressions/reach on 15 Nov 2025: **views** = every showing (additive), **viewers** = unique people,
  true only per day or per 28-day window — never add viewers across days, windows or posts. Typical post = median viewers.
- Fetch in `lib/fb-fetch.ts` (no imports, shared with `scripts/fb-backfill.mjs`), refresh in `lib/fb-refresh.ts`,
  read + maths in `lib/facebook.ts`. Two Graph quirks, both answer EMPTY instead of failing: all seven daily
  metrics in one 89-day call (asked in groups of ≤3), and a heavy page of posts (paging starts at 25 and halves).
- The daily `cron-instagram` (6am MYT) refreshes Facebook too (last 10 days + posts of the last 30 days); the
  Refresh button on the page calls `/api/facebook/refresh`. `npm run fb:backfill` (Mac, Composio CLI via
  `composio dev playground-execute` against the project) fills history: page figures from Aug 2024, posts from 1 Jan 2025.
- Combined figures add platforms, so someone on both counts twice — the UI says so. Empty in demo mode.

**Instagram — one page since 16 Oct 2026** (`app/_v3/pages/ContentLab.tsx` + `lab.css`, maths in `lib/v3/lab-math.ts`,
read in `lib/v3/content-lab.ts`; the Studio/Lab view switch and `cfo-ig` cookie are gone). Top to bottom: verdict headline,
Growth (account-wide, Studio panels, ignores filters), the sticky filter bar, the post analysis, Timing, Audience, the ranked posts.
Post figures read THIS YEAR's posts only (from 1 Jan, Malaysia time — Aereon's call) with each post's latest
`ig_post_metrics` reading, filtered in the browser: timeline (opens on the last 90 days — or the year so far when that
is shorter; also year / 30 days / a month, or click a bar), format, angle, hook. Only "Reach over time" keeps the whole
year, as context. Hook = the caption's first line, classified by `HOOKS` (first match wins); angle by `angleOf`; brand
placement by `brandOf`. Typical = median; hit = 2× the slice's typical. Post panels are empty in demo mode.
Ranked posts show a small cover: the snapshot's own image for its ~40 newest posts, else
`/api/instagram/cover?code=<shortcode>` (signed-in only, shortcodes in `ig_posts` only, nothing stored, no Composio call),
else a format tile; tapping a cover plays the post in Instagram's embed player.
**Every filtered page follows `docs/FILTER-BAR.md`** (one sticky bar, a scope chip on every panel).

**Media kit v2** (`app/_v3/pages/MediaKit2.tsx` + `kit2.css`, 2 Oct 2026): audience-led kit with
the reach skyline and captioned brand wall, always drawn in Studio Standard. Chosen in Settings
beside v1; `/?preview=kit&kit=v2` previews it when signed in.

## Public proof numbers (16 Oct 2026)

Landing (reel + classic), both media kits, `/hello` and its share card show ONE overall figure per stat across every
connected platform — `socialTotals()` in `lib/social-totals.ts` (today Instagram + Facebook; a new platform is one more
source there). Labels never name platforms or explain double counting (Aereon's call). Views/interactions = 90 days;
reach = each platform's best (or latest) month of unique people, added across platforms, never across windows.

## Site analytics (16 Oct 2026)

**Site analytics** is its own nav group (after Social): who visits the public pages and what they do —
`/analytics/landing` (Landing page, `/`) and `/analytics/link` (Link page, `/hello`), 7/30/90 days; `/analytics` redirects. `/links` is setup only. All from `site_visits` via `/api/track` (no IP, daily
visitor hash, owner and bots never counted). The landing logs `/land/…` events (`LANDING_EVENT` in `lib/site-visits.ts`)
from `app/_components/LandingTracker.tsx`: version seen, scroll 25–100%, visible time 10s–10m, browser language, and
every tap — named from `data-t` or the link's target by `lib/landing-taps.ts`, so all landing versions are covered.
Maths `lib/landing-insights.ts` (tested), read `lib/site-stats.ts`. **Bot filter** (`splitBots` in
`lib/hello-insights.ts`, both pages, from `CHECKS_FROM` = 17 Oct 2026): a daily visitor counts only if they scrolled,
stayed 10s+ visible, tapped, or opened the page in an app (Instagram, Facebook…); the rest — crawlers that run JS from
data-centre cities (Council Bluffs, Ashburn, Boardman) and instant bounces — are shown only as a "left out" count.
/hello sends the same scroll/time signals (`EngagementTracker`).

## Showcase (5 Oct 2026)

Landing page + media kits show one tile per kind of work (`lib/showcase.ts`, `npm run ig:archive`). Full rules: `docs/SHOWCASE.md` — read before touching the classifier or tiles.

## Property (own sidebar group since 4 Oct 2026)

Overview, loans, tenancy, costs, submeter — full rules in `app/(app)/property/CLAUDE.md` (read it before touching `lib/property*`, `lib/tenancy-math.ts`, `lib/submeter*` or `app/_v3/pages/property/`).
**Privacy (repo is public):** loan balances, property/bank names, spreads, tenant names, rents, fees and deposits live only in Supabase and `.property-data/` — never in code, comments or commit messages. `property_data_issue` fixes need Aereon's approval.

## Sign-in (Google + backup passcode, added 4 Oct 2026)

Front door is **Sign in with Google** (`lib/google-auth.ts`, `app/api/auth/google/**`: OIDC code flow +
PKCE, hand-written, no auth library). Active only when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set;
until then the login page is the old passcode form. A verified Google account must also be allowed:
- `ADMIN_EMAILS` (env, comma-separated) — always in, needs no database. This is the break-glass list:
  keep a second Google account on it.
- `app_users` table (`supabase/app-users.sql`) — the managed list, edited on the **Users** page (`/users`,
  `app/(app)/users/`): role owner/admin/viewer, `active` (Lock), `last_login_at`. Owner manages everyone; admin
  manages viewers only; nobody edits their own row; ADMIN_EMAILS people show read-only (role owner). Since 12 Oct 2026 a
  viewer is read-only: `requireSession()` (every server action) and `canEdit()` refuse them; they can still open every tab, and v3 hides
  controls marked `data-edit` for them (`data-view-only` on the shell).
- Session cookie `cfo_session` = `exp.nonce.who.sig`; `who` = `pw` (passcode) or the Google email.
  Signed with `AUTH_SECRET` (falls back to `APP_PASSCODE`). Rotating it signs everyone out. `signedIn()`
  (lib/auth.ts, used by the (app) layout and every server action) re-checks a Google account against the list,
  so Lock/Remove cuts someone off on their next click. The proxy only checks the cookie signature.
- On production with no `AUTH_SECRET`/`APP_PASSCODE` the app now fails CLOSED (`openDoor()` in lib/session.ts);
  local and preview runs still open without a secret.
- Backup access ladder: second Google account → passcode (`APP_PASSCODE`, behind "Use backup passcode") →
  edit env vars in Vercel. `PASSCODE_LOGIN=off` retires the passcode and invalidates its sessions.
  Once `AUTH_SECRET` is set, rotating `APP_PASSCODE` no longer kills existing passcode sessions — rotate
  `AUTH_SECRET` or set `PASSCODE_LOGIN=off` instead.
- Google redirects only to one host (`APP_BASE_URL`, default https://aereonwong.com), registered in
  Google Cloud. `/api/logout` (POST) clears the cookie; Sign out is in the v3 rail, the classic sidebar and Settings → Account.
  The login page (`app/login/`) is Studio Standard: KLCC photo beside the form, passcode folded under the Google button.

## Quotations (10 Oct 2026)

`/invoices/quotes`. A quote is a `doc` row, status `quotation` — never income; the quote→invoice link lives on the INVOICE only (`meta.quotation_id`). Full rules: `app/(app)/invoices/quotes/CLAUDE.md`.

## Link page — /hello (11 Oct 2026)

Instagram bio link (`app/hello/`, public), edited on the `/links` tab, stored as one `records` row (`doc`/`setting`/`hello`). Full rules: `app/hello/CLAUDE.md` (read before touching `lib/hello*`, `lib/socials.ts`, `/links` or `/api/track`).

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

Last full audit: `docs/REVIEW-2026-10-12.md` — read it before auditing again.

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
