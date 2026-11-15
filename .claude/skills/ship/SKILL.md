---
name: ship
description: Ship the current change to the live app — build, review, open a pull request, wait for checks, and merge into main. Aereon's standing "merge without asking" rule, as one repeatable command.
disable-model-invocation: true
---

# /ship

Merging into `main` deploys https://aereonwong.com within a minute or two, so every step below is
a gate. Run them in order. **If a gate fails, fix it and re-run that gate; if it cannot be fixed,
stop and explain in plain words. Never skip ahead to the merge.**

Aereon's standing instruction (26 Sep 2026): once a change is done, open the pull request and merge
it yourself — don't hand over a merge button. This skill is that instruction with the brakes on.

## Never

- Never `git add -A`, `git add .` or `git commit -a`. Stage files by name.
- Never commit to `main` directly, force-push, or use `--no-verify`.
- Never stage `.env*` (except `.env.example`), `.claude/settings.local.json`, `.property-data/`,
  `.expense-data/`, `.quote-data/`, or anything holding a key, a real amount or a client's details.
- Never merge with a BLOCK verdict open, a failing build, or a red or still-running check.
- Never put private data in a commit message or PR body — the repo is public (no loan balances,
  bank/property/tenant names, real expenses, client amounts).
- Never merge someone else's unfinished work that happens to sit in the folder.
- Never bare `git stash` / `git stash pop` — other sessions share the stash.

## 1. Know exactly what is being shipped

1. `git status --short` and `git diff`. Write down the files that belong to THIS change.
2. Other sessions share `~/AereonDashboard`, so the folder often holds unrelated edits. If you are
   in the main folder with a mixed tree, move this change to its own worktree:
   `git worktree add .claude/worktrees/<name> -b <short-kebab-name> origin/main`, then apply only
   this change's files there. If it is unclear which files belong, **ask Aereon — this is the one
   question `/ship` may ask.**
3. On `main`? Branch first: `git switch -c <short-kebab-name>`.
4. `graphify-out/` changes stay out of the commit unless the change is about the graph.

## 2. Build and test (app code only)

Skip this step only when the diff touches no app code at all (docs, `.claude/`, skills, memory).

1. `npx tsc --noEmit` — clean.
2. `npm test` — all pass.
3. `npm run build` — exit 0. `[CFO] SUPABASE… not set` lines during static generation are
   expected, not errors.

## 3. Review — in parallel, as subagents, on the diff

Run every reviewer whose row matches a changed file. Give each the diff and a scratch directory.

| Reviewer | Run when the diff touches |
|---|---|
| `build-verifier` | any app code (always, unless step 2 was skipped) |
| `numbers-guard` | `lib/records.ts`, `lib/invoices.ts`, `lib/analytics.ts`, `lib/v3/`, `lib/privacy*.ts`, `lib/expenses*`, `lib/property*`, `lib/demo-data.ts`, a dashboard / Cash In / invoice / expenses page, `app/api/cron-*`, the bot's tools |
| `security-reviewer` | `proxy.ts`, `lib/agent-site.ts`, `lib/auth.ts`, `lib/session.ts`, `app/api/**`, any `'use server'` file, `lib/supabase.ts`, `lib/telegram.ts`, login/demo code, `vercel.json`, `next.config.*`, or a new page or route |
| `ig-guard` | Instagram / Facebook / TikTok fetch or refresh, snapshots, `/instagram`, `/social`, Media Kit, the public pages' live numbers |
| `invoice-auditor` | `lib/invoice*.ts`, `lib/quotes.ts`, `app/api/invoices/**`, `app/(app)/invoices/**`, the Telegram `/invoice` and `/quote` flows, import / reconcile scripts, a template |
| `theme-qa` | `app/globals.css`, `app/_v3/*.css`, a chart component, shared UI |

Each opens with **Verdict: SHIP** or **Verdict: BLOCK**.

- **BLOCK** → fix every BLOCKER, then re-run that reviewer on the new diff. Repeat until SHIP.
- **WARNINGs** → fix the cheap ones; list the rest in the PR body and the final summary.
- A reviewer that errors or times out has not passed. Re-run it.

## 4. Keep the knowledge graph current

If code changed: `graphify update .` (AST-only, free). Leave the `graphify-out/` result
uncommitted unless it belongs to this change.

## 5. Commit, push, open the pull request

1. `git add <file> <file> …` — by name. Then `git diff --cached --stat` and read it.
2. Commit message: first line = what changed **for Aereon**, in plain English, no jargon; blank
   line; detail if needed.
3. `git push -u origin <branch>`
4. `gh pr create --base main` with the body shape below.

```
## What changed
Invoice Details: a deposit invoice now has a "raise balance" button that drafts the balance
invoice from the deposit's own Canva design.

## Why
Balance invoices were being rebuilt by hand and twice went out with the full contract as the total.

## How it was checked
- npm run build — pass · npm test — pass
- build-verifier: SHIP (3 routes × 2 viewports)
- numbers-guard: SHIP · invoice-auditor: SHIP after fixing 1 blocker (second-click duplicate)
- Opened /invoices/details locally and previewed a balance for a test deposit

## Left open
- WARNING (invoice-auditor): pairs filed before 12 Nov store no percent — shown without one.
```

## 6. Wait for checks, then merge

1. `gh pr checks <number> --watch` — the Vercel preview deploy is the check that matters.
2. All green → `gh pr merge <number> --squash --delete-branch`.
   (From a worktree, `gh` may complain it cannot switch to `main` locally — the merge itself still
   happened. Confirm with `gh pr view <number> --json state,mergedAt`.)
3. A check fails → read its log, fix, push, wait again. Cannot be fixed → stop and explain.

## 7. Confirm it's live

1. Wait for the production deploy (`gh pr view <number> --json mergeCommit`, then
   `gh api repos/aereonwong/AereonDashboard/commits/<sha>/status`, or `vercel ls` if signed in).
2. Check the affected page really renders: public paths with `curl -sI https://aereonwong.com/<path>`
   (expect 200); private pages redirect to `/login` (307) when signed out — that proves the deploy is
   up, not that the page works, so say which you checked.
3. Docs-only change: there is nothing to render; say so.
4. Remove the worktree if you made one (`git worktree remove .claude/worktrees/<name>`), and in
   the main folder `git pull --ff-only` only if its tree is clean of conflicting edits.

## Final message to Aereon — this shape

```
Shipped: Invoice Details now has a "raise balance" button on deposit invoices.
PR: https://github.com/aereonwong/AereonDashboard/pull/165 — merged, live on aereonwong.com.
Checked: build, tests, 3 reviewers (all SHIP), /invoices/details opened locally.
Open: 1 warning — older deposit/balance pairs show without a percent.
```

When it stops early instead:

```
Not shipped. Stopped at step 3: numbers-guard says BLOCK.
Problem: the new "owed" total counts issued invoices (lib/v3/summary.ts:142).
Why I can't fix it myself: it needs your call on whether Canva imports count as owed.
Nothing was pushed. The work is on branch owed-total in .claude/worktrees/owed-total.
```
