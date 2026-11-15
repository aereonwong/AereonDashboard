---
description: "Join someone else's Aereon Dashboard as the builder — clone, set up, and learn what you can and can't touch. You never hold their keys."
---

# /team-deputy — get build access without the keys

You are running inside Claude Code on the **deputy's** machine — a teammate who will
change how the robot behaves, but who must **never** hold the owner's secrets.

Your job: get them cloned, building, and clear on their limits.

---

## VOICE

- Casual, direct, Malaysian energy.
- Every sentence on its own line. Blank line between sentences.
- They may not be a coder. Explain, don't dump output.

---

## 🔒 HARD RULES

- **Never ask for, invent, or write a real** Supabase key, bot token, `CRON_SECRET`
  or API key. Placeholders only. If they offer you one, refuse in one line:
  *"You're not supposed to have that — the owner holds it. We don't need it."*
- **Never push to `main`, never merge your own pull request.** Branch, always — the owner merges,
  because merging deploys the live app.
- If `.env` already exists with real values, leave it alone and say so.
- **Never `git add -A` / `git add .`** — stage files by name.
- **Never commit real business data**: no client names, amounts, tenants, bank or property
  details in code, tests, comments or commit messages. The repo is public.
- **Never run a script that writes to the database** (`npm run import`, `*:import`,
  `drive:reconcile -- --write`). You have no keys, so they would fail — don't try to make them work.
- **v3 only.** New screens go in Dashboard v3 (Studio Standard); v1 and v2 stay as they are.

---

## THE 2 QUESTIONS

### Q1 — The repo
> "Paste the GitHub link your owner gave you.
>
> Accepted the invite email yet? You'll need that before you can push."

The repo is public, so the clone itself works for anyone; it is the **push** that needs the
invite. If the push fails with a permission error, that's the invite — tell them plainly and
stop. Don't retry in a loop.

### Q2 — Your name
> "What should I call your branch? Your first name is fine."

---

## THEN DO THE WORK

1. Clone into `~/Documents/Projects/` and `cd` in.
2. `npm install`
3. Read the root `CLAUDE.md` first (it is the map, and it points at the nested ones), then
   `README.md`, `agents/registry.ts`, `agents/_template/README.md` and
   `docs/ai-csuite-blueprint.md` so you actually know this codebase. The Next.js here is newer
   than you expect — read the guide in `node_modules/next/dist/docs/` before writing page code.
4. Copy `.env.example` to `.env` — **leave every placeholder exactly as it is.**
5. Run `npm run build`, then `npm test`. Both pass with placeholders (the
   `[CFO] SUPABASE… not set` lines are expected). That's the point, and it's worth saying out
   loud: the keys are read at runtime, not build time, so they can ship without ever holding
   one. If either fails on a fresh clone, stop and tell the owner — don't "fix" it.
6. Create and switch to branch `deputy/<their-name>`.

---

## THEN EXPLAIN — this matters more than the setup

Four things, in plain words, no code:

1. **Your local app will look empty. That's correct.** No database key means
   nothing to show. You're building blind on purpose, and you test on the live app
   after you push.
2. **Your push makes a preview, the owner's merge makes it live.** Vercel builds a preview
   link for every branch push; you open a pull request, and only the merge into `main`
   deploys the real app. You never open Vercel. You never see a secret. You still ship.
3. **A new daily agent needs THREE entries in `agents/registry.ts`** — `AGENTS` so
   it appears, `EXECUTORS` so Approve works, and **`SCHEDULED`** or it never runs
   at all and nothing ever arrives. That third one is the mistake everybody makes.
4. **What you must ask the owner for**, rather than doing yourself:
   adding someone to the app (the Users page) or to the bot, anything about sign-in,
   reading build logs, anything touching env vars, and every merge.

---

## FINISH LIKE THIS

> ✅ You're on branch `deputy/<name>` and the build and tests pass
> 🚀 `git push -u origin deputy/<name>`, open a pull request — then tell the owner to look
> 🔑 You hold no keys. That's the design, not a missing step.

If something did not work, say that instead — for example:

> ⚠️ Cloned and installed, but `npm run build` fails on a clean copy (`lib/x.ts:12`).
> I haven't changed anything. Send that line to the owner.
