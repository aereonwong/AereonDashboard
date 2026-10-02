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
- `app/api/` — `telegram` (bot webhook), `cron-daily` (unscheduled since 27 Sep 2026; route kept), `cron-news` (9am digest, unscheduled since 27 Sep 2026; route kept),
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
  History (added 2 Oct 2026, `supabase/instagram-history.sql`): `ig_post_metrics`,
  `ig_account_snapshots`, `ig_account_daily`. Fetching lives in `lib/ig-fetch.ts` — no runtime
  imports, so `scripts/ig-refresh.mjs` loads the same file. Insight metrics differ per format
  (Reels: watch time; posts: follows, profile visits) — asking for an unsupported one fails the call.
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
its structure, design-system pointers, and per-world rules. **Design direction (2 Oct 2026):**
Aereon prefers Studio Standard (`canon`) and the classic look; new UI work targets those, not
Contact Sheet or Flight HUD.

**Media kit v2** (`app/_v3/pages/MediaKit2.tsx` + `kit2.css`, 2 Oct 2026): audience-led kit with
the reach skyline and captioned brand wall, always drawn in Studio Standard. Chosen in Settings
beside v1; `/?preview=kit&kit=v2` previews it when signed in.

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
