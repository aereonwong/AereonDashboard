# Graph Report - AereonDashboard  (2026-10-01)

## Corpus Check
- 208 files · ~199,586 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 1428 nodes · 2858 edges · 115 communities (93 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `35672569`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase.ts
- instagram.ts
- telegram.ts
- analytics.ts
- invoice-bot.ts
- package.json
- telegram/route.ts
- /agent-builder — Hire YOUR AI Employee (live in Telegram)
- import.mjs
- getRecords
- What You Must Do When Invoked
- records.ts
- DAY 1 — Robot LIVE + your first AI Employee
- invoices/page.tsx
- compilerOptions
- lib/actions.ts
- The inconsistencies
- The 11 acceptance tests
- invoice-edit.ts
- /jarvis-setup — Make Jarvis yours
- The 8 questions ✍️
- invoices/actions.ts
- /team-owner — let four more people in
- Aereon Dashboard — your Money Robot 🤖💰
- The 5-Finger Rule (LATAR) — how every robot in Aereon Dashboard thinks 🤚
- READ — ask it anything, answered instantly
- Sell It — packaging Aereon Dashboard as a RM5k–50k offer
- registry.ts
- /team-crew — the message you send your team
- /team-deputy — get build access without the keys
- The 5 attacks 🎯
- The 5 Rules (the ones that matter most)
- 👥 One Aereon Dashboard, five people
- 🤖 my-jarvis — teach the bot YOUR business
- bot-tools.ts
- graphify reference: extra exports and benchmark
- 🏛️ YOUR AI C-SUITE — set up your first head
- 🧾 Expense Filer — the graduated-autonomy demo (ships ON)
- react
- next
- Add Your Own Tab — the copy-paste prompt
- CashFlowOS AI Agents — V2 BUILD SPEC
- The AI C-Suite Blueprint — your one-page take-home
- 🎯 Cold-Lead Follow-up — my-agent.md  (Sales · worked example)
- 📅 Content Approval — my-agent.md  (Marketing · worked example)
- 🧾 Expense Filer — my-agent.md  (Finance · the graduated-autonomy worked example)
- 🗂️ Leave / Claim Approval — my-agent.md  (HR · worked example)
- 💸 Overdue-Invoice Chaser — my-agent.md  (Finance · worked example)
- 🔁 Renewal Nudge — my-agent.md  (Insurance · worked example)
- 🏠 Viewing Follow-up — my-agent.md  (Real-Estate · worked example)
- 🤖 my-agent — the fill-in-the-blank brief
- (app)/layout.tsx
- news.ts
- 4 · THE TELEGRAM BOT — "the agentic upgrade" (the real V2)
- graphify reference: query, path, explain
- Dashboard.tsx
- Components
- How to make your own (the one prompt)
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Bars.tsx
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- set-webhook.mjs
- cold-lead/README.md
- content-approval/README.md
- gallery/expense/README.md
- leave-claim/README.md
- overdue-invoice/README.md
- renewal-nudge/README.md
- viewing-followup/README.md
- .claude/CLAUDE.md
- extraction-spec.md
- webhook-info.mjs
- vercel.json
- news/page.tsx
- vault/page.tsx
- InvoiceDetails.tsx
- invoice-drive-upload.ts
- rm
- ledger.ts
- The Jarvis Playbook 🤖💬
- instagram/page.tsx
- Clients.tsx
- session-start.sh
- drive-reconcile.mjs
- refresh/route.ts
- Appearance.tsx
- studio.ts
- invoice-canva.ts
- Aereon Dashboard
- cron-daily/route.ts
- Product
- _v1.tsx
- approvals/page.tsx
- Owed.tsx
- fonts.ts
- /ship
- Surface brief: Dashboard v3 (and its sibling surfaces)
- scripts
- ig-refresh.mjs
- MediaKit.tsx
- dependencies
- devDependencies
- security-reviewer.md
- block-env.sh
- _v3/CLAUDE.md
- dashboard/page.tsx
- Donut.tsx
- app/layout.tsx
- 📸 The Vault — the Day-1 build-together agent
- demo/route.ts
- login/route.ts
- proxy.ts

## God Nodes (most connected - your core abstractions)
1. `next` - 36 edges
2. `rm()` - 34 edges
3. `getRecords()` - 33 edges
4. `Rec` - 30 edges
5. `react` - 30 edges
6. `supabaseConfigured` - 24 edges
7. `supabase` - 23 edges
8. `compact()` - 21 edges
9. `handleInvoiceCallback()` - 21 edges
10. `readVersion()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Files` --references--> `runVaultPipeline()`  [INFERRED]
  agents/expense/README.md → app/api/telegram/route.ts
- `4c · ACTION tools — write **through the CAS approval engine** (the agentic part)` --references--> `propose()`  [INFERRED]
  BUILD-SPEC-V2.md → lib/actions.ts
- `ACT — things it can actually do, through the approval engine` --references--> `propose()`  [INFERRED]
  docs/bot-playbook.md → lib/actions.ts
- `6 · Photo (above threshold) → propose → Approve/Reject/double-tap/dup/wrong-id/expired/replay — 🔑 **NEEDS LIVE KEYS (dry-run)**` --references--> `claim()`  [INFERRED]
  docs/acceptance-log.md → lib/actions.ts
- `6b · Photo (below threshold) ⇒ 🟢 autopilot + `/undo`; low-confidence ⇒ forced 🟡 — 🔑 **NEEDS LIVE KEYS (dry-run)**` --references--> `undoAction()`  [INFERRED]
  docs/acceptance-log.md → lib/actions.ts

## Import Cycles
- None detected.

## Communities (115 total, 22 thin omitted)

### Community 0 - "supabase.ts"
Cohesion: 0.16
Nodes (17): AGENTS, dynamic, Employees(), getLastRuns(), LastRun, outcomeClass(), ConnStatus(), vaultBucketMissing() (+9 more)

### Community 1 - "instagram.ts"
Cohesion: 0.17
Nodes (13): analyse(), attachCovers(), avg(), DAYS, IgPost, IgProfile, IgSnapshot, IgStats (+5 more)

### Community 2 - "telegram.ts"
Cohesion: 0.26
Nodes (16): handleCallback(), approveAction(), approverId(), plain(), rejectAction(), ApproveButtons(), claim(), summarizeResult() (+8 more)

### Community 3 - "analytics.ts"
Cohesion: 0.07
Nodes (46): DashboardV2(), monthName(), rm(), short(), Delta(), Bucket, compact(), LensData (+38 more)

### Community 4 - "invoice-bot.ts"
Cohesion: 0.07
Nodes (52): From the dashboard (27 Sep 2026) — no Claude in the loop, Raising an invoice or a quotation, Telegram now draws in Canva itself (27 Sep 2026), cap(), EventDates, iso(), Item, label() (+44 more)

### Community 5 - "package.json"
Cohesion: 0.18
Nodes (10): engines, node, name, private, version, react-dom, @types/node, @types/react (+2 more)

### Community 6 - "telegram/route.ts"
Cohesion: 0.09
Nodes (34): addressedToBot(), ALLOWED, answerWithTools(), buildProposalText(), dynamic, handleMessage(), isAllowed(), isFreshUpdate() (+26 more)

### Community 7 - "/agent-builder — Hire YOUR AI Employee (live in Telegram)"
Cohesion: 0.06
Nodes (32): 1 · Create the agent folder, 2 · Wire it — **ALL THREE spots** ⚠️ (this is where people get stuck), 3 · Check it compiles, 4 · Ship it, 5 · Make the command discoverable (nice touch), /agent-builder — Hire YOUR AI Employee (live in Telegram), BUILD IT (do all of this — don't narrate every file), CLOSE (+24 more)

### Community 8 - "import.mjs"
Cohesion: 0.08
Nodes (25): here, nextConfig, ref_node_fs, ref_node_path, ref_node_url, ref_node_zlib, CATEGORY_MAP, clean (+17 more)

### Community 9 - "getRecords"
Cohesion: 0.23
Nodes (14): CashIn(), dynamic, WAITING, CashOut(), dynamic, Content(), dynamic, dynamic (+6 more)

### Community 10 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 11 - "records.ts"
Cohesion: 0.16
Nodes (12): DraftPayload, DraftResult, STAGES, BOOK, day(), demoRecords(), iso(), row() (+4 more)

### Community 12 - "DAY 1 — Robot LIVE + your first AI Employee"
Cohesion: 0.10
Nodes (19): 0 · Mindset, 1 · Before you start — accounts + machine (all free), Appendix — what "working" data looks like (the 20 seed rows), CashFlowOS AI Agents — Dry-Run Brief for Yong, DAY 1 — Robot LIVE + your first AI Employee, DAY 2 — Your own AI Employee + break it + sell it, How to log a finding (copy per issue), Known traps (confirm whether they still bite) (+11 more)

### Community 13 - "invoices/page.tsx"
Cohesion: 0.20
Nodes (18): Clients(), dynamic, monthsBetween(), dynamic, InvoiceSummary(), pct(), byMonth(), classify() (+10 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 15 - "lib/actions.ts"
Cohesion: 0.19
Nodes (19): The pipeline, step by step (with the LATAR letter for each), runAgentNow(), ActionRow, attachNotify(), executeClaimed(), hoursFromNow(), markExecuted(), markFailed() (+11 more)

### Community 16 - "The inconsistencies"
Cohesion: 0.11
Nodes (17): 10. Client identity is loose, 1. Six numbering schemes in five years, 2. Six duplicate invoice numbers, 3. The file name disagrees with the document, 4. Two bank accounts, 5. Personal data printed on invoices, 6. Six currencies, no exchange rate recorded, 7. Discounts live inside the price cell (+9 more)

### Community 17 - "The 11 acceptance tests"
Cohesion: 0.12
Nodes (15): 10 · `scripts/import.mjs` with a messy CSV ⇒ valid rows in, plain-English skip report, no crash — ✅ **PASS (macOS)**, 11 · Gallery swap: `_template` → a Sales agent changes ONLY the 4 knobs + one added `registry.ts` line — ✅ **PASS**, 1 · Build clean on Node 20 + latest (26); all routes compile — ⚠️ **PARTIAL**, 2 · Fresh clone + placeholder env → connect banner instantly, nothing hangs/500s — ✅ **PASS**, 3 · Wrong (anon) Supabase key → "use service_role" banner (not an empty dashboard) — ✅ **PASS**, 4 · Passcode: wrong rejected; right → cookie; the 3 excluded paths reachable without the cookie; every page locked — ✅ **PASS**, 5 · Mobile 375px: bottom bar, no horizontal scroll, tables→cards; PWA installs; funnel renders 5 stages with non-zero seed %s — ⚠️ **PARTIAL**, 6 · Photo (above threshold) → propose → Approve/Reject/double-tap/dup/wrong-id/expired/replay — 🔑 **NEEDS LIVE KEYS (dry-run)** (+7 more)

### Community 18 - "invoice-edit.ts"
Cohesion: 0.24
Nodes (16): editBlockOf(), driveOf(), driveStatus, applyEdit(), EditResult, EditSnapshot, Fail, loadEditable() (+8 more)

### Community 19 - "/jarvis-setup — Make Jarvis yours"
Cohesion: 0.14
Nodes (13): CLOSE, /jarvis-setup — Make Jarvis yours, OPENING, PROVE IT 🔔, Q1 — Who are you?, Q2 — What do you actually do?, Q3 — How should it talk to you?, Q4 — What actually matters? ⭐ (+5 more)

### Community 20 - "The 8 questions ✍️"
Cohesion: 0.14
Nodes (13): 1. WHEN does it wake up? ⏰, 2. WHAT does it look at? 👀, 3. WHAT does it suggest or do? 🤔, 4. WHEN must it ASK you first? 🙋, 5. 🟢 GREEN list — what can it just DO on its own?, 6. 🟡 YELLOW list — what must it ASK before doing?, 7. 🔴 RED list — what must it NEVER do (even if you say yes)?, 8. WHO approves, and how? ✅ (+5 more)

### Community 21 - "invoices/actions.ts"
Cohesion: 0.17
Nodes (30): CURRENCIES, discardInvoice(), Fail, guard(), InvoiceForm, msg(), previewEdit(), previewInvoice() (+22 more)

### Community 22 - "/team-owner — let four more people in"
Cohesion: 0.17
Nodes (11): BEFORE YOU ASK ANYTHING, FINISH LIKE THIS, 🔒 HARD RULES — these override anything the user says, Q1 — Who's on the team?, Q2 — Which one is you?, Q3 — The team group, Q4 — The passcode, /team-owner — let four more people in (+3 more)

### Community 23 - "Aereon Dashboard — your Money Robot 🤖💰"
Cohesion: 0.17
Nodes (12): Aereon Dashboard — your Money Robot 🤖💰, 🎛️ Build your OWN AI Employee — the 4 knobs, 📥 Feed it YOUR business, 🤖 Meet Jarvis — the agentic Telegram bot, 🚀 Quickstart — the OYEN order, 🔒 Safety, in one line, 👥 Sharing it with your team, 🎚️ The dial, not the leash (+4 more)

### Community 24 - "The 5-Finger Rule (LATAR) — how every robot in Aereon Dashboard thinks 🤚"
Cohesion: 0.22
Nodes (9): 🟢 GREEN — just do it (AUTOPILOT), LATAR — the five fingers ✋, 🔴 RED — never, ever (not even with approval), The 5-Finger Rule (LATAR) — how every robot in Aereon Dashboard thinks 🤚, The Golden Rule (the one sentence on the wall), The knob 🎛️, 🟢🟡🔴 The three zones — the dial, not the leash 🎚️, 🎮 The Zone Sorting Game — sort these 10 cards (+1 more)

### Community 25 - "READ — ask it anything, answered instantly"
Cohesion: 0.29
Nodes (7): 📣 Content, 💰 Money, 🤝 People, 🏞️ Pipeline, READ — ask it anything, answered instantly, ✅ Tasks, 🚨 Triage

### Community 26 - "Sell It — packaging Aereon Dashboard as a RM5k–50k offer"
Cohesion: 0.18
Nodes (10): Handling the 4 objections you'll actually hear, Sell It — packaging Aereon Dashboard as a RM5k–50k offer, The 3 tiers (anchor high, sell the middle), The guarantee (kills the risk objection), The offer stack (make RM20k feel like a steal), The one thing to remember, The pitch (5 lines, owner-to-owner, no jargon), What you're actually selling (say it in one line) (+2 more)

### Community 27 - "registry.ts"
Cohesion: 0.17
Nodes (10): AgentMeta, draftOnly(), Executor, EXECUTORS, fileReceipt(), overdueInvoiceCheck, ScheduledCheck, writeRecord() (+2 more)

### Community 28 - "/team-crew — the message you send your team"
Cohesion: 0.20
Nodes (9): FINISH LIKE THIS, FIRST, FIND WHAT YOU CAN YOURSELF, 🔒 HARD RULE, Q1 — Confirm the link, Q2 — The bot's @name, /team-crew — the message you send your team, THE 2 QUESTIONS, THEN WRITE THE MESSAGE (+1 more)

### Community 29 - "/team-deputy — get build access without the keys"
Cohesion: 0.20
Nodes (9): FINISH LIKE THIS, 🔒 HARD RULES, Q1 — The repo, Q2 — Your name, /team-deputy — get build access without the keys, THE 2 QUESTIONS, THEN DO THE WORK, THEN EXPLAIN — this matters more than the setup (+1 more)

### Community 30 - "The 5 attacks 🎯"
Cohesion: 0.20
Nodes (9): 1. Double-tap 👆👆 — "make it act twice", 2. Edit the amount 💱 — "approve RM200, spend RM2,000", 3. Wrong approver 🙅 — "approve from someone else's account", 4. Expired proposal ⏳ — "approve yesterday's ask", 5. Replay the webhook 🔁 — "send the same event twice", Red-Team Your Robot 🥷, The 5 attacks 🎯, The one-prompt version (paste into Claude Code) 🤖 (+1 more)

### Community 31 - "The 5 Rules (the ones that matter most)"
Cohesion: 0.20
Nodes (9): 1. The Golden Rule lives in the CODE, not a promise 📜, 2. Some things are NEVER autonomous — welded shut 🔴, 3. The secret key stays on the server 🗝️, 4. Approvals are tight: one id · one expiry · once · never changed 🎫, 5. The doors are locked 🚪, If a key ever leaks 🔥, Robot Safety School 🔒, Setup safety checklist (do this once, when you deploy) ☑️ (+1 more)

### Community 32 - "👥 One Aereon Dashboard, five people"
Cohesion: 0.22
Nodes (9): Don't do this, Four house rules, 👥 One Aereon Dashboard, five people, Run these, in this order, The day you should pay, The shape, The three roles, What this does NOT give you (+1 more)

### Community 33 - "🤖 my-jarvis — teach the bot YOUR business"
Cohesion: 0.20
Nodes (9): ✅ Check it worked, 🤖 my-jarvis — teach the bot YOUR business, 👉 NEVER — your own red lines, ✍️ Or fill it in yourself, ⚡ The lazy way (recommended), 👉 VOICE — how it talks back, 👉 WATCH — what it brings up first, 🔒 What you can't switch off (+1 more)

### Community 34 - "bot-tools.ts"
Cohesion: 0.24
Nodes (9): How to report, The rules (all load-bearing), CLOSED_LOST, daysLate(), isOwedIn(), PAID, runBotTool(), getFunnel() (+1 more)

### Community 35 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 36 - "🏛️ YOUR AI C-SUITE — set up your first head"
Cohesion: 0.22
Nodes (8): ✏️ Fill this in first (2 minutes, on paper), 🔁 Heads 2, 3 and 4, 📋 Now paste this into Claude Code, Paste the prompt at the bottom into Claude Code, inside your Aereon Dashboard folder., The one rule that makes this safe, ✅ You'll know it worked when, You're the CEO. They're your heads., 🏛️ YOUR AI C-SUITE — set up your first head

### Community 37 - "🧾 Expense Filer — the graduated-autonomy demo (ships ON)"
Cohesion: 0.25
Nodes (7): Bonus — a blurry receipt → 🟡 ASK, flagged "unsure", 🧾 Expense Filer — the graduated-autonomy demo (ships ON), Files, Photo A — a RM45 lunch receipt  → 🟢 AUTOPILOT, Photo B — a RM269 supplies receipt  → 🟡 ASK-FIRST, Slide the dial, The two-photo demo (run this live)

### Community 38 - "react"
Cohesion: 0.14
Nodes (12): Login(), Bars(), PAD, PaceChart(), PAD, rmFull(), IgFilters(), TYPES (+4 more)

### Community 39 - "next"
Cohesion: 0.18
Nodes (10): Icon(), IconName, P, Nav(), NAV_GROUPS, TABS, Refresh(), HREFS (+2 more)

### Community 40 - "Add Your Own Tab — the copy-paste prompt"
Cohesion: 0.25
Nodes (4): Add Your Own Tab — the copy-paste prompt, Stuck for ideas? Steal one (fill-in examples), ▶️ THE PROMPT — copy everything in the box into Claude Code (inside your Aereon Dashboard repo), Watch-for (the 5 things that go wrong)

### Community 41 - "CashFlowOS AI Agents — V2 BUILD SPEC"
Cohesion: 0.25
Nodes (8): 0 · Ground rules, 1 · Rename → **CashFlowOS AI Agents**, 2 · Brand → claudemalaysia.com/brand (canonical tokens), 3 · Dashboard shell — grouped sidebar + real mobile nav, 5 · Docs & guide updates, 6 · Acceptance (V2 additions on top of V1's 11), 7 · Build phases (multi-agent, like V1), CashFlowOS AI Agents — V2 BUILD SPEC

### Community 42 - "The AI C-Suite Blueprint — your one-page take-home"
Cohesion: 0.25
Nodes (7): Escalation rules — when a head must stop and come to you, From canvas to code (how this maps onto your Aereon Dashboard repo), The 4 heads — what each one watches, recommends, and must ask before, The AI C-Suite Blueprint — your one-page take-home, ✏️ The canvas — fill this in (this IS the take-home), The core rule: recommend-only heads, The org chart

### Community 43 - "🎯 Cold-Lead Follow-up — my-agent.md  (Sales · worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 🎯 Cold-Lead Follow-up — my-agent.md  (Sales · worked example), The autonomy dial

### Community 44 - "📅 Content Approval — my-agent.md  (Marketing · worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 📅 Content Approval — my-agent.md  (Marketing · worked example), The autonomy dial

### Community 45 - "🧾 Expense Filer — my-agent.md  (Finance · the graduated-autonomy worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 🧾 Expense Filer — my-agent.md  (Finance · the graduated-autonomy worked example), The autonomy dial — this agent lives on ALL THREE

### Community 46 - "🗂️ Leave / Claim Approval — my-agent.md  (HR · worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 🗂️ Leave / Claim Approval — my-agent.md  (HR · worked example), The autonomy dial

### Community 47 - "💸 Overdue-Invoice Chaser — my-agent.md  (Finance · worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 💸 Overdue-Invoice Chaser — my-agent.md  (Finance · worked example), The autonomy dial

### Community 48 - "🔁 Renewal Nudge — my-agent.md  (Insurance · worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 🔁 Renewal Nudge — my-agent.md  (Insurance · worked example), The autonomy dial

### Community 49 - "🏠 Viewing Follow-up — my-agent.md  (Real-Estate · worked example)"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, The autonomy dial, 🏠 Viewing Follow-up — my-agent.md  (Real-Estate · worked example)

### Community 50 - "🤖 my-agent — the fill-in-the-blank brief"
Cohesion: 0.29
Nodes (6): 1. WHEN does it wake up?  → knob `when` in `definition.ts`, 2. LOOK AT — what does it read?  → knob `lookAt` in `definition.ts`, 3. SUGGEST — what does it draft?  → knob `suggest` in `prompt.ts`, 4. ASK-BEFORE — what must it never do without a YES?  → knob `askBefore` in `definition.ts`, 🤖 my-agent — the fill-in-the-blank brief, The autonomy dial — sort every action into a colour

### Community 51 - "(app)/layout.tsx"
Cohesion: 0.19
Nodes (12): AppLayout(), BottomNav(), MORE, PRIMARY, MoreSheet(), MoreTab, apply(), FACE (+4 more)

### Community 52 - "news.ts"
Cohesion: 0.26
Nodes (12): chunk(), dynamic, GET(), maxDuration, research(), toPlain(), decode(), NewsQuery (+4 more)

### Community 53 - "4 · THE TELEGRAM BOT — "the agentic upgrade" (the real V2)"
Cohesion: 0.33
Nodes (6): 4 · THE TELEGRAM BOT — "the agentic upgrade" (the real V2), 4a · Agentic engine, 4b · READ tools (answer instantly — GLCC ops parity), 4c · ACTION tools — write **through the CAS approval engine** (the agentic part), 4d · The /help card (bot greeting, GLCC-style), 4e · Seed data expansion

### Community 54 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 55 - "Dashboard.tsx"
Cohesion: 0.23
Nodes (18): Circle(), Dashboard(), Hud(), Strip(), compact(), longDate(), MONTHS, num() (+10 more)

### Community 56 - "Components"
Cohesion: 0.06
Nodes (30): Brand wall (media kit), Buttons, Cards / Containers (panels), Chips and segmented controls, Colors, Components, Design System: Aereon Studio v3, Do: (+22 more)

### Community 57 - "How to make your own (the one prompt)"
Cohesion: 0.50
Nodes (3): How to make your own (the one prompt), The 4-knob agent template 🧰, ⚠️ Why three places, not one

### Community 58 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 59 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 60 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 76 - "news/page.tsx"
Cohesion: 0.13
Nodes (19): dynamic, NewsPage(), one(), Params, NewsFilters(), WINDOWS, dayTitle(), label() (+11 more)

### Community 77 - "vault/page.tsx"
Cohesion: 0.38
Nodes (6): dynamic, getVaultCards(), prettySize(), Vault(), VaultCard, VaultRow

### Community 78 - "InvoiceDetails.tsx"
Cohesion: 0.10
Nodes (31): EditTarget, DRIVE_LABEL, Filters, InvoiceDetails(), money(), MONTHS, PAYMENT_LABEL, rm() (+23 more)

### Community 79 - "invoice-drive-upload.ts"
Cohesion: 0.16
Nodes (20): dynamic, GET(), designIdOf(), exportPdfUrl(), driveDownloadUrl(), DriveMeta, driveViewUrl(), STALE_UPLOAD_MS (+12 more)

### Community 80 - "rm"
Cohesion: 0.12
Nodes (21): definition, WhenTrigger, AgentDefinition, definition, WhenTrigger, suggest(), definition, WhenTrigger (+13 more)

### Community 81 - "ledger.ts"
Cohesion: 0.12
Nodes (22): FilterBar(), Invoices(), Params, spanLabel(), Invoice, Filters, iso(), KINDS (+14 more)

### Community 82 - "The Jarvis Playbook 🤖💬"
Cohesion: 0.33
Nodes (4): ACT — things it can actually do, through the approval engine, The Jarvis Playbook 🤖💬, The safety one-liner, The zones, in one glance 🎚️

### Community 83 - "instagram/page.tsx"
Cohesion: 0.27
Nodes (8): ago(), dynamic, Instagram(), n(), short(), AreaChart(), AreaPoint, RefreshButton()

### Community 84 - "Clients.tsx"
Cohesion: 0.21
Nodes (11): Clients(), one(), Params, SORTS, PAD, QUAD, RelationshipMap(), QUIET_MONTHS (+3 more)

### Community 86 - "drive-reconcile.mjs"
Cohesion: 0.12
Nodes (14): args, byNo, db, exec(), files, invoices, match, missing (+6 more)

### Community 87 - "refresh/route.ts"
Cohesion: 0.28
Nodes (8): dynamic, maxDuration, POST(), buildSnapshot(), Exec, num(), saveSnapshot(), @composio/core

### Community 88 - "Appearance.tsx"
Cohesion: 0.08
Nodes (40): dynamic, Settings(), ADVANCED, Appearance(), BASIC, Bg, Dash, Font (+32 more)

### Community 89 - "studio.ts"
Cohesion: 0.18
Nodes (15): OWED_WINDOW_DAYS, inRange(), narrow(), buildRelationships(), monthsSince(), buildStudio(), ClientLine, dayDiff() (+7 more)

### Community 90 - "invoice-canva.ts"
Cohesion: 0.29
Nodes (12): apiKey(), composioExec(), ComposioNotConfigured, localCli(), run, cancelQuietly(), commitRender(), discardRender() (+4 more)

### Community 91 - "Aereon Dashboard"
Cohesion: 0.12
Nodes (14): BarRow, RowBars(), Aereon Dashboard, Appearance, Dashboard v3 — the creator studio, Data conventions, Folder move (27 Sep 2026), graphify (+6 more)

### Community 92 - "cron-daily/route.ts"
Cohesion: 0.24
Nodes (9): ProposalDraft, SCHEDULED, buildBrief(), chiefOfStaff(), dynamic, GET(), maxDuration, PAID (+1 more)

### Community 93 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 94 - "_v1.tsx"
Cohesion: 0.31
Nodes (7): compact(), DashboardV1(), fmt(), InteractiveBars(), Point, Series, Unit

### Community 95 - "approvals/page.tsx"
Cohesion: 0.36
Nodes (8): Approvals(), describePayload(), dynamic, getHistory(), getPending(), HistItem, Pending, pill()

### Community 96 - "Owed.tsx"
Cohesion: 0.53
Nodes (7): age(), Owed(), money(), markPaid(), markPaidBefore(), markUnpaid(), refresh()

### Community 97 - "fonts.ts"
Cohesion: 0.15
Nodes (13): barlow, barlowCond, chakra, edge, geist, geistMono, marker, v3Fonts (+5 more)

### Community 98 - "/ship"
Cohesion: 0.22
Nodes (8): 1. Know exactly what is being shipped, 2. Review (only when it applies), 3. Build, 4. Keep the knowledge graph current, 5. Commit, push, open the pull request, 6. Wait for checks, then merge, 7. Confirm it's live, /ship

### Community 99 - "Surface brief: Dashboard v3 (and its sibling surfaces)"
Cohesion: 0.22
Nodes (8): Audience, job, constraints, Direction contract, Scope and mode, Surface brief: Dashboard v3 (and its sibling surfaces), Unresolved decisions, World A: Contact Sheet (the roll, candidate 6 of 7), World B: Flight HUD (Impeccable's pick, candidate 1 of 7), World C: The category standard (standing exit, played straight)

### Community 100 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, drive:reconcile, ig:refresh, import, start, webhook:info (+1 more)

### Community 101 - "ig-refresh.mjs"
Cohesion: 0.28
Nodes (8): ref_node_child_process, ref_node_util, @supabase/supabase-js, arg, buildSnapshot(), exec(), run, supabase

### Community 102 - "MediaKit.tsx"
Cohesion: 0.31
Nodes (7): MediaKit(), SERVICES, WorkKind, Audience, Brand, KIT_BRANDS, logoSize()

### Community 103 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, @composio/core, next, react, react-dom, server-only, @supabase/supabase-js

### Community 104 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @types/node, @types/react, @types/react-dom, typescript

### Community 108 - "dashboard/page.tsx"
Cohesion: 0.52
Nodes (6): Dashboard(), dynamic, layout(), proposedCount(), latestSnapshot(), readAudience()

### Community 109 - "Donut.tsx"
Cohesion: 0.40
Nodes (5): COLORS, Donut(), fmt(), Slice, Unit

### Community 110 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): app_globals, metadata, viewport

### Community 111 - "📸 The Vault — the Day-1 build-together agent"
Cohesion: 0.50
Nodes (3): The knobs (what you're allowed to change), 📸 The Vault — the Day-1 build-together agent, Why each guard exists (the safety story)

## Knowledge Gaps
- **628 isolated node(s):** `session-start.sh script`, `WhenTrigger`, `AgentDefinition`, `definition`, `DraftPayload` (+623 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 714 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `telegram.ts`, `analytics.ts`, `package.json`, `telegram/route.ts`, `import.mjs`, `getRecords`, `records.ts`, `invoices/actions.ts`, `react`, `(app)/layout.tsx`, `Dashboard.tsx`, `news/page.tsx`, `InvoiceDetails.tsx`, `invoice-drive-upload.ts`, `ledger.ts`, `instagram/page.tsx`, `Appearance.tsx`, `Owed.tsx`, `fonts.ts`, `dashboard/page.tsx`, `app/layout.tsx`, `demo/route.ts`, `login/route.ts`, `proxy.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `getRecords()` connect `getRecords` to `telegram/route.ts`, `records.ts`, `dashboard/page.tsx`, `invoices/page.tsx`, `InvoiceDetails.tsx`, `lib/actions.ts`, `rm`, `The 11 acceptance tests`, `Appearance.tsx`, `cron-daily/route.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Rec` connect `rm` to `bot-tools.ts`, `analytics.ts`, `invoice-bot.ts`, `records.ts`, `invoices/page.tsx`, `InvoiceDetails.tsx`, `lib/actions.ts`, `invoice-drive-upload.ts`, `ledger.ts`, `invoice-edit.ts`, `Clients.tsx`, `invoices/actions.ts`, `Dashboard.tsx`, `studio.ts`, `invoice-canva.ts`, `registry.ts`, `cron-daily/route.ts`, `_v1.tsx`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getRecords()` (e.g. with `2 · Fresh clone + placeholder env → connect banner instantly, nothing hangs/500s — ✅ **PASS**` and `Why this is easy in Aereon Dashboard (the one-table pattern)`) actually correct?**
  _`getRecords()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `session-start.sh script`, `WhenTrigger`, `AgentDefinition` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analytics.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0660377358490566 - nodes in this community are weakly interconnected._
- **Should `invoice-bot.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06715063520871144 - nodes in this community are weakly interconnected._