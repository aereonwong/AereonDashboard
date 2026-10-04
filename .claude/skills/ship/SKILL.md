---
name: ship
description: Ship the current change to the live app — build, review, open a pull request, wait for checks, and merge into main. Aereon's standing "merge without asking" rule, as one repeatable command.
disable-model-invocation: true
---

# /ship

Merging into `main` deploys https://aereonwong.com, so every step below is a gate. If any
gate fails, stop and explain in plain words — never skip ahead to the merge.

## 1. Know exactly what is being shipped

- `git status` and `git diff`. List the files that belong to THIS change.
- The main folder often holds unrelated, unfinished edits from other sessions. **Never** `git add -A`
  or `git add .` — stage only the files for this change, by name. If it is unclear which files
  belong, ask Aereon.
- Never stage `.env*` (except `.env.example`), `.claude/settings.local.json`, or anything with a key in it.
- If on `main`, create a branch first (`git switch -c <short-kebab-name>`).

## 2. Review (only when it applies)

Run these in parallel as subagents, on the diff:

- **numbers-guard** — if the change touches `lib/records.ts`, `lib/invoices.ts`, `lib/analytics.ts`,
  `lib/v3/`, `lib/demo-data.ts`, any dashboard or Cash In page, `app/api/cron-*`, or the bot's tools.
- **security-reviewer** — if the change touches `proxy.ts`, `app/api/**`, `lib/supabase.ts`,
  `lib/telegram.ts`, login/demo/passcode code, `vercel.json`, or adds a new page or route.

Fix every BLOCKER they report before going on. Mention any WARNINGs to Aereon in the summary.

## 3. Build

- `npm run build` must finish cleanly. The `[CFO] SUPABASE… not set` lines during static generation
  are expected, not errors.
- Skip only when the change touches no app code at all (docs, `.claude/`, skills).

## 4. Keep the knowledge graph current

- If code changed: `graphify update .` (AST-only, free). Leave `graphify-out/` changes out of the
  commit unless they belong to this change.

## 5. Commit, push, open the pull request

- Commit message: one plain-English line saying what changed for Aereon, then detail if needed.
- `git push -u origin <branch>`
- `gh pr create --base main` with a short plain-English description: what changed, why, and how it
  was verified (build output, page checked).

## 6. Wait for checks, then merge

- `gh pr checks <number> --watch` (Vercel preview deploy is the check that matters).
- All green → `gh pr merge <number> --squash --delete-branch`.
- A check fails → read its log, fix, push, and wait again. If it can't be fixed, stop and explain.

## 7. Confirm it's live

- After merge, the production deploy takes a minute or two. Check the affected page on
  https://aereonwong.com actually renders (Playwright or `curl -I` for public paths).
- Tell Aereon in two or three plain sentences: what shipped, the PR link, and that it's live.
