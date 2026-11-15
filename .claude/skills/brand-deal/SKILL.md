---
name: brand-deal
description: Run a brand collaboration from first enquiry to final payment — read the brief, flag the risks, price it from past work, draft the reply, quote, deposit invoice, deliverables and dates, the results report for the client, balance invoice and close-out. Use when Aereon says "a brand emailed", "new collab", "reply to this enquiry", "what should I charge", "read this brief", "where is the X deal", "make the campaign report", "send them the results", or pastes a brand's email, brief or contract.
---

# Brand deal — enquiry to paid

One deal = **one private deal file** that every stage reads and updates, so any session can pick
the deal up where the last one stopped. This skill joins skills that already exist; it does not
replace them:

| Stage | Done by |
|---|---|
| Quotation, deposit, balance, revisions to a document | `raise-invoice` |
| Hook, script, caption, stories | `ig-reel`, `ig-caption`, `ig-story`, `ig-human` |
| Editing, voice, sound | `video-editing-style`, `voice-over`, `real-sfx` |
| Reading a PDF / Word / deck brief | `markitdown <file>` |
| Reading numbers correctly | `docs/SOCIAL.md` (read it before step 7) |

## Never

- **Never send anything to the brand** — no email, DM, WhatsApp, calendar invite, shared link.
  Draft it; Aereon sends.
- **Never invent a price.** No past job or rate-card line to price from → say so and ask.
- Never agree, on Aereon's behalf, to exclusivity, usage rights, whitelisting / paid ads, raw
  footage, a deadline or a discount. List them as decisions.
- Never start production before the deposit rule in the deal file is met — or Aereon says go.
- Never accept or sign a contract, tick "I agree", or type bank details into a brand's vendor form.
- Never put a brand name, fee, contact, contract term or deal file in the repo, a commit message
  or a PR — the repo is public. Deal files live in git-ignored `.deal-data/` only.
- Never write "CAAM", "licensed drone pilot" or any credential Aereon has not confirmed.
- Never report a number Aereon's own tables don't hold. No estimates, no rounding up, no
  "approximately" on a figure that was not read.
- Never add reach (or viewers) across posts, days or platforms as if it were unique people.
- Never post a sponsored piece without the disclosure the deal file names (step 6).
- Never count a quotation, or an unpaid invoice, as income.

## The deal file

`.deal-data/<YYYYMM>-<brand-slug>.md` (git-ignored; month = month of the enquiry). Create it at
step 1, update the **Stage** line and the log at every step. Shape:

```
# <Brand> — <campaign>
Stage: 3 quoted            (1 enquiry · 2 priced · 3 quoted · 4 confirmed · 5 deposit paid ·
                            6 in production · 7 live · 8 reported · 9 paid · closed-won / closed-lost)
Contact: <name, role, email> · via <agency, if any> · mailbox <collab@ | hello@ | DM>
Docs: quotation <no> · deposit <no> · balance <no> · contract <Drive link>

## Ask
<what they asked for, in their words, one short paragraph>

## Scope (agreed)
- 1 x IG reel synced to TikTok
- 2 x IG stories with link
- Usage: organic repost by brand, 3 months. Paid ads: not included
- Exclusivity: none
- Revisions: 2 rounds on the edit, script approved before the shoot

## Dates
Brief in <date> · script due <date> · shoot <date> · draft due <date> · go-live <date> ·
report due <date> · deposit due <date> · balance due <date>

## Money
Fee <currency amount> · deposit <percent> · terms <e.g. balance 30 days after go-live>
Priced from: <which past jobs / rate-card lines>

## Decisions waiting on Aereon
- [ ] …

## Log
2026-11-15 enquiry read, reply drafted
```

Also private, same folder: `.deal-data/rates.md` — the rate card (one line per kind of deliverable:
last three prices charged, date, what was included). Step 9 keeps it current. If it does not exist,
build the first version in step 2 from past quotations and show Aereon before relying on it.

**Resuming:** "where is the X deal" → read its file, state the Stage, the next date, and what is
waiting on whom. Then carry on from that step.

## Steps

### 1. Read the enquiry

1. Get everything they sent: the email thread (Gmail label "Collab" / `collab@`), attachments
   through `markitdown`, any deck link. A DM screenshot counts.
2. Fill the **enquiry table** — write `not said` rather than guessing:

   | Field | What they said |
   |---|---|
   | Brand / product | |
   | Who is writing | brand direct · agency · platform |
   | Deliverables | kinds and counts |
   | Platforms | |
   | Dates | shoot, draft, go-live, event |
   | Budget | figure · "what's your rate?" · product only |
   | Usage | organic repost · paid ads · whitelisting · length |
   | Exclusivity | category, length |
   | Approval | script? edit? how many rounds? |
   | Extras | travel, drone, location permits, raw files |

3. **Check it is real.** Flag as `suspect` — and stop before any reply — when: the sender's domain
   does not match the brand; they ask Aereon to pay, buy stock or "cover shipping"; the link asks
   for an Instagram / Meta login; the offer is far above market with a same-day deadline.
4. **Flag the risks**, each as one line with what it costs Aereon:
   product-only or "exposure" · perpetual or unlimited usage · paid ads / whitelisting not priced ·
   exclusivity with no fee · payment 60+ days or "after campaign ends" · unlimited revisions ·
   raw footage · drone work with no venue / permit owner named · a category Aereon already has a
   live deal in (check open deal files) · go-live sooner than the edit can honestly be done.
5. Create the deal file at Stage `1 enquiry`.

### 2. Price it

1. Read `.deal-data/rates.md`. Then find the three closest past jobs: same kind of deliverable,
   newest first — Quotations (`/invoices/quotes`) and Invoice Details; the Dashboard's paid-reach
   panel gives the median RM per 1,000 reach (`lib/v3/paid-reach.ts`).
2. Build the price **line by line** — one line per deliverable, then usage, exclusivity, travel
   and rush as their own lines, never folded into the reel price.
3. Show the working, then give three numbers: **ask** (what goes on the quote), **floor** (walk
   away below this) and the **swap** — what to remove from scope, not from price, if they push back.
4. Foreign brand → quote in their currency only if Aereon says so; never convert into RM totals.
5. Aereon picks the number. Record it and "Priced from" in the deal file → Stage `2 priced`.

### 3. Draft the reply

Create a **Gmail draft** on the same thread, from the address they wrote to. Never send.
Shape, in Aereon's voice — short, warm, no hype; run it through `ig-human`:

1. One line that shows the brief was read (their product, their date).
2. What Aereon proposes — the scope as bullets, same wording the quote will print.
3. The questions that block a quote (only fields marked `not said` that change price or dates).
4. Next step: "I'll send the quotation once these are confirmed" — or the fee, if Aereon said to
   state it.

No rate in the first reply unless they asked for one and Aereon chose it. No media-kit numbers
typed by hand — link `aereonwong.com/mediakit`.

### 4. Quote

`raise-invoice` → quotation (path A or C). Scope of work = the deal file's Scope bullets, one per
line, **including the usage and exclusivity lines** — what is not printed is not agreed. Validity
14 days unless Aereon says otherwise. Record the number → Stage `3 quoted`.

They send their own contract instead → read it with `markitdown`, list every clause that differs
from the deal file (usage, exclusivity, payment days, indemnity, termination, who owns raw files)
as a table `Clause · Theirs · Ours · Matters because`. Aereon decides and signs.

### 5. Confirmed → deposit and dates

1. Their yes must be **in writing** (email or signed quote). Save the link in the deal file.
2. `raise-invoice` → deposit invoice from the quote (Convert, then path E for the split). Fixed
   fee under Aereon's deposit threshold, or a client Aereon bills in full → one invoice, say which.
3. Fill every date in the deal file by working back from go-live: report due = go-live + 14 days.
4. Offer to put shoot, draft-due and go-live on Aereon's calendar — create them only on a yes,
   as private events with no guests.
5. Stage `4 confirmed`; `5 deposit paid` only when Aereon says the money arrived.

### 6. Production

- Script first when the deal says the brand approves it: `ig-reel` → send as a draft for approval.
- Edit: `video-editing-style` (no full stop on on-screen text; flash cuts). Voice: `voice-over`.
- Caption: `ig-caption`, with `📸 @aereonwong` above the `📍` line, the brand's required tags and
  hashtags exactly as the brief spells them, and the disclosure: Instagram's paid-partnership label
  when the brand asks for it, otherwise the wording the deal file names (e.g. `#ad`). No disclosure
  agreed → ask before posting.
- Every round of client changes: log it (`round 1 of 2 — <date> — what changed`). A request past
  the agreed rounds, or a new deliverable, is a **scope change** — tell Aereon with the price line
  from `rates.md`; do not just do it.
- Before go-live, check the piece against the Scope bullets one by one. Stage `6` → `7 live` with
  each post's link and date.

### 7. Results report

Not before **7 full days** after the last post went live (reach is still moving), and on the
date the deal file promises.

1. Refresh the stored numbers (Content Lab → refresh, or `npm run ig:refresh`), then **link the
   posts to the invoice** (Invoice Details → link posts; stored as `meta.ig_posts`).
2. Read each post's latest stored figures — never from memory, never from the app's screenshot of
   a different date. Stories expire: their numbers must be captured within 24 hours of posting; if
   they were not, say "not captured", don't estimate.
3. Compare each post with Aereon's **typical post of the same kind** — the MEDIAN over the last
   90 days (reel against reels, carousel against carousels).
4. Rules for the figures: reach is per post — list posts separately; a combined line may add
   views, likes, comments, saves and shares, but if it adds reach it must say "people who saw two
   posts count twice". Each platform on its own row. Date-stamp every figure ("as of 22 Nov 2026").
5. Write the report (shape below). Show Aereon in chat first. On a yes, lay it out as a one-page
   Canva design or PDF, with Instagram's own insight screenshots attached if the brand asked for
   them. Aereon sends it. Stage `8 reported`.

A post that did worse than typical is reported as it is, with one honest line on why and what
Aereon would change. Never drop a weak post from the report.

### 8. Balance and payment

`raise-invoice` → path D (balance button) on the date the terms name. Past due → draft a short,
polite chaser on the same thread (invoice number, amount, due date, bank details as on the
invoice) for Aereon to send; second chaser 7 days later. Stage `9 paid` only when Aereon confirms.

### 9. Close out

Update `.deal-data/rates.md` (deliverable, price, date, what was included, effective RM per 1,000
reach). In the deal file write three lines: what went well, what cost more time than priced, what
to change next quote. Set `closed-won`. A deal that died → `closed-lost` with the reason in one
line (price · timing · went quiet · declined by Aereon) and mark the quotation lost on the
Quotations page.

## What to send back to Aereon

**After steps 1–3 (new enquiry):**

```
<Brand> — <campaign>  ·  looks real | SUSPECT: <why>

They want     1 reel + 2 stories, go-live 12 Dec, usage "all channels" (length not said)
Not said      budget · usage length · revision rounds
Risks         1. Paid ads implied, not priced — costs you the ad-usage fee
              2. Go-live 9 days after shoot — tight for 2 rounds
Price         ask <amount> · floor <amount> · swap: drop the stories
              from: <3 past jobs, month + kind, no client names needed>
Reply         drafted in Gmail on their thread (not sent) — 3 questions in it
Your call     1. State the fee now or after their answers?
              2. Paid-ads usage: price it or refuse it?
Deal file     .deal-data/202611-<brand>.md  ·  Stage 2 priced
```

**Results report (step 7) — the client-facing page:**

```
<Campaign> × Aereon Wong — results as of <date>

Delivered     1 reel (IG + TikTok) · 2 stories — all live on the agreed dates

Reel · Instagram · posted <date>
  Reach <n> · Views <n> · Likes <n> · Comments <n> · Saves <n> · Shares <n>
  vs my typical reel (median, last 90 days): reach <x>× · saves <x>×
Reel · TikTok · posted <date>
  Views <n> · Likes <n> · Comments <n> · Shares <n>
Stories · <date>
  Story 1: reach <n> · link taps <n>      Story 2: reach <n> · link taps <n>

What worked   <one line, tied to a number above>
Worth noting  <one honest line>
Next time     <one suggestion the brand can act on>
```

**Status ("where is the X deal"):**
`<Brand>: Stage 6 in production — draft due Thu 3 Dec (round 1 of 2 used). Waiting on: brand's
script approval since 28 Nov. Deposit paid. Next from you: nothing until they reply.`

## Before saying a step is done

- Deal file updated — Stage, dates, log line.
- Everything outward-facing exists as a **draft**, and the reply says where.
- Every figure quoted has a source (a row, a past document, a stored reading) and a date.
- Decisions that are Aereon's are listed as questions, not quietly chosen.
- `git status` shows nothing from `.deal-data/`.
