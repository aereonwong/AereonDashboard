---
name: audit
description: Whole-repo health check for Aereon Dashboard — dependency CVEs, security, code quality, build/tests, and what eats Claude tokens — then fix the safe items and ship. Use when Aereon says "audit", "check security", "health check", "optimise everything" or "review all my work".
disable-model-invocation: true
---

# /audit

Run it top to bottom. Write findings to `docs/REVIEW-<YYYY-MM-DD>.md` (plain English, ranked,
file:line) and point CLAUDE.md's "Last full audit" line at it.

## 0. Before anything

- `df -h ~` — under ~3 GB free, do NOT `npm ci` a new worktree (it needs ~1.5 GB with the build).
  Update the lockfile only (`npm install <pkg>@<ver> --package-lock-only`) and let the Vercel preview be
  the build check. Never delete Aereon's files to make room — tell him what is big.
- Work in a worktree (`git worktree add ../AereonDashboard-<name> -b <branch> origin/main`): other
  sessions share the main folder.
- Read the previous `docs/REVIEW-*.md` and only re-check what changed since (`git log --since=<date>`).

## 1. Dependencies (cheap, highest value)

`npm audit --omit=dev`. Critical/high in `next` → bump to the patched exact version.
Transitive ones → `npm audit fix --package-lock-only`. Never `--force` without reading what it changes.

## 2. Security — in parallel, as subagents

- `security-reviewer` on the whole repo since the last review (routes, proxy, server actions,
  privacy-mode loaders, secrets in tracked files, public deck/scripts for private data).
- One `general-purpose` read-only agent for code quality: `npx tsc --noEmit`, `npm test`, dead exports,
  sequential awaits, unbounded selects, heavy client bundles. Ask it to tag SAFE-TO-FIX vs NEEDS-JUDGEMENT.
- Private-data grep yourself (repo is public): emails, bank / property / tenant names, real amounts.

## 3. Token cost

- `wc -c CLAUDE.md` — keep the root under ~16 KB. Detail belongs in `docs/*.md` or a nested
  `CLAUDE.md` (loads only when files in that folder are read), with a 2–4 line pointer left behind.
- Memory: `MEMORY.md` index lines only; long how-to memories should become skills.
- Repeated multi-step chat workflows (look at recent sessions / claude-mem) → make a skill.

## 4. Fix and ship

Fix SAFE-TO-FIX items only; list NEEDS-JUDGEMENT ones in the review doc for Aereon. Never delete data or
files. Then `/ship` (build, reviewers on the diff, PR, green checks, merge).
