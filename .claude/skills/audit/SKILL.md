---
name: audit
description: Whole-repo health check for Aereon Dashboard — dependency CVEs, security, code quality, build/tests, and what eats Claude tokens — then fix the safe items and ship. Use when Aereon says "audit", "check security", "health check", "optimise everything" or "review all my work".
disable-model-invocation: true
---

# /audit

A whole-repo health check: find what is unsafe, broken, slow or wasteful; fix what is safe to fix;
leave Aereon a ranked list of the rest. Run it top to bottom.

**Deliverables — the audit is not done without all four:**

1. `docs/REVIEW-<YYYY-MM-DD>.md` in the format at the bottom.
2. The root `CLAUDE.md` "Last full audit" line pointing at it.
3. One PR with the SAFE-TO-FIX items, merged through `/ship`.
4. A short chat summary: what was fixed, what needs Aereon, in that order.

## Never

- Never delete data, files, branches, worktrees or Drive/Canva items — not even to free disk
  space. Say what is big and let Aereon decide.
- Never fix a NEEDS-JUDGEMENT item. List it.
- Never `npm audit fix --force`, and never bump a major version, without reading what it changes.
- Never put a real secret, amount, client, tenant, bank or property name in the review doc — the
  repo is public. Point at `file:line` and say what kind of thing it is.
- Never re-audit what the last review already cleared and nobody has touched since.
- Never apply an open `property_data_issue` fix — those need Aereon's approval.
- Never touch v1/v2 beyond keeping them building.

## Terms

- **SAFE-TO-FIX** — the fix is mechanical, behaviour-preserving, covered by the build or a test,
  and changes no figure, no public page copy, no auth rule and no data. Examples: a patched
  dependency within the same major, a dead export, a missing `await requireSession()` on a server
  action, an unbounded `select` given a limit that is above the real row count.
- **NEEDS-JUDGEMENT** — anything else: a change to how a number is computed, what a page shows,
  who can do what, a schema change, a deletion, a paid service, a design call.
- **Severity** — `P0` exploitable or showing a wrong figure now · `P1` will bite soon (a fragile
  guard, a known CVE not yet reachable) · `P2` cost, speed or tidiness.

## 0. Before anything

1. `df -h ~` — under ~3 GB free, do NOT `npm ci` a new worktree (it needs ~1.5 GB with the build).
   Update the lockfile only (`npm install <pkg>@<ver> --package-lock-only`) and let the Vercel
   preview be the build check.
2. Work in a worktree — other sessions share the main folder:
   `git worktree add .claude/worktrees/audit-<date> -b audit-<date> origin/main`.
3. Read the previous `docs/REVIEW-*.md` (the newest). Note its date and its open items, then
   `git log --since=<that date> --stat` — only re-check what changed, plus every item it left open.

## 1. Dependencies (cheap, highest value)

1. `npm audit --omit=dev`.
2. Critical/high in `next` → bump to the patched **exact** version, then read
   `node_modules/next/dist/docs/` upgrade notes for anything that touches `proxy.ts` or the CSP.
3. Transitive ones → `npm audit fix --package-lock-only`.
4. Record each advisory: package, severity, fixed-in, whether our code reaches it.

## 2. Security and quality — in parallel, as subagents

Launch together:

- **`security-reviewer`** on everything changed since the last review: routes, proxy,
  `lib/agent-site.ts` public lists, server actions, privacy-mode loaders, secrets in tracked
  files, the public deck (`public/mediakit/`) and scripts for private data.
- **`numbers-guard`** on money code changed since the last review.
- **`ig-guard`** / **`invoice-auditor`** only if their areas changed.
- One **`general-purpose`** read-only agent for code quality: `npx tsc --noEmit`, `npm test`,
  dead exports, sequential awaits that could be parallel, unbounded selects, heavy client
  bundles, `'use client'` files that could be server components. Ask it to tag every finding
  SAFE-TO-FIX or NEEDS-JUDGEMENT using the definitions above, with `file:line`.

Yourself, meanwhile — the private-data grep (the repo is public): emails, bank / property / tenant
names, real amounts, order numbers, Drive and Canva ids that are not already documented as public,
in code, tests, docs, screenshots and `git log` messages since the last review.

Check each agent's result before relying on it: open two of its `file:line` claims.

## 3. Token cost

1. `wc -c CLAUDE.md` — keep the root under ~16 KB. Detail belongs in `docs/*.md` or a nested
   `CLAUDE.md` (loads only when files in that folder are read), with a 2–4 line pointer left behind.
2. Nested `CLAUDE.md` files: one topic each, bullets not walls, no history that no longer changes
   what to do.
3. Memory: `MEMORY.md` holds index lines only; a long how-to memory should become a skill.
4. Repeated multi-step chat workflows (recent sessions / claude-mem) → propose a skill; write it
   only if it is SAFE-TO-FIX-sized, otherwise list it.
5. Instruction files that contradict the code or each other (a removed feature still described, a
   wrong path) → fix; they cost tokens **and** cause wrong work.

## 4. Fix and ship

1. Fix SAFE-TO-FIX items only, smallest first. One commit per kind of fix.
2. `npx tsc --noEmit`, `npm test`, `npm run build`.
3. Write the review doc; update the "Last full audit" line.
4. `/ship` (reviewers on the diff, PR, green checks, merge).

## Review doc — exactly this shape

(The findings below are made up to show the shape — they are not real.)

```markdown
# Review — 30 October 2026

Scope: everything since docs/REVIEW-2026-10-12.md (41 commits) + its 3 open items.
Method: npm audit, security-reviewer, numbers-guard, code-quality agent, private-data grep.

## Summary
- Fixed in this PR: 7 (1 P0, 2 P1, 4 P2)
- Needs Aereon: 3
- Still open from last review: 1

## Fixed
| # | Sev | What | Where |
|---|-----|------|-------|
| 1 | P0 | Server action exportMonth had no sign-in check — anyone could download a month of spending | app/(app)/expenses/actions.ts:44 |
| 2 | P1 | next 16.4.3 → 16.4.5 (cache-poisoning advisory; our proxy was reachable) | package.json |

## Needs Aereon
1. **P1 — Facebook "30 days" tile uses 28 days of data.** lib/facebook.ts:120.
   Options: relabel "28 days" (safe, 1 line) or fetch 30 (one more API call per refresh).
   Recommendation: relabel.

## Still open from last review
- Invoice meta write race (deferred until the Telegram bot returns).

## Checked and clean
proxy + public lists · cron guards · privacy-mode loaders · classifier order · IG post cap

## Token cost
CLAUDE.md 15.7 KB (limit 16) · moved "Sign-in" detail to docs/SIGN-IN.md
```

Rules for the doc: plain English, ranked by severity, every item with `file:line`, each
"Needs Aereon" item with options and one recommendation, no private values.

## Chat summary — this shape

```
Audit done — docs/REVIEW-2026-11-15.md, PR #170 merged and live.
Fixed 7: 1 serious (an export anyone could call), 2 dependency patches, 4 tidy-ups.
Needs you (3): Facebook tile label · whether viewers may export CSV · 1.2 GB of old worktrees.
```
