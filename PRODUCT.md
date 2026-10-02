# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: **Aereon Wong**, a Kuala Lumpur tech and travel content creator, drone pilot and
photographer who trades as SY Creative Production Sdn. Bhd. He is not a developer. The app is
**internal** — nobody else logs in. The single exception is the public landing page (see below).

He opens it to answer three questions, confirmed 26 Sep 2026:

1. **Am I on track this year?** — pace against last year, whether this month is good or worrying.
2. **Is my audience growing?** — Instagram reach and followers, and which content earns it.
3. **Who owes me money?** — unpaid and overdue invoices, and when cash should land.

## Product Purpose

A private business cockpit that turns his real invoice documents into a picture of his work
performance — how much he earns and **what type of work** earns it — alongside his Instagram
performance. Success is opening it and knowing, in seconds, whether the business is healthy and
what to do next.

Planned extension (not built): tracking customer receipts and payments in a finance area.

## Positioning

It is built on his own records, not a template's demo data: 185 invoices since March 2021 across
131 clients, imported from his Canva invoice archive, plus live Instagram snapshots. Its numbers
are his, and its insights are written in plain language rather than accounting terms.

## Operating Context

- Invoices and quotations are raised through a Telegram bot (`/invoice`, `/quote`) and rendered
  as documents from Canva templates. The web app reads the same Supabase records.
- Instagram data arrives daily (cron, 6am MYT) as snapshots (`ig_snapshots`: profile plus the latest
  40 posts) and history tables: `ig_post_metrics` (every post at every refresh), `ig_account_snapshots`
  (30-day account totals, follower vs new-people split, formats, follower demographics) and
  `ig_account_daily` (reach and follows gained per day).
- Deployed on Vercel. Used mostly on desktop, also on phone.

## Capabilities and Constraints

- **Ringgit totals exclude foreign-currency invoices**; those are reported separately, never
  converted and summed.
- **A quotation is never income.** Quotations are stored as `doc` rows and must never appear in
  revenue, charts or totals.
- **Dashboard versions are user-selectable in Settings.** v1 (the original creator view) and v2
  (the operating picture) must remain available; the redesign ships as **v3** alongside them,
  each labelled with a version and date.
- An existing appearance system offers 12 accent palettes, 4 typefaces, light/dark, and three
  backgrounds. v3 may define its own treatment but must not break v1/v2's.
- Instagram media previews play through Instagram's own embed using stored permalinks, which do
  not expire. Stored snapshots currently carry **no image or video URLs**; thumbnails require
  adding `media_url` and `thumbnail_url` to the fetch, and those URLs expire between snapshots.

## Brand Commitments

- **Background: "Merdeka night"** — his own photograph of KLCC during Merdeka
  (`public/img/klcc-merdeka.jpg`). Pinned by him as the basis for the new design.
- Instagram handle **@aereonwong**. Bio: "Creative Visual Travel Content Creator — Tech | Aerial |
  Travel | Hotel | Tourism | Adventure — Portraits | Events", based in KL.
- Voice: plain, direct, specific. Insights read like a sharp adviser, not a report.
- **Brands on the public media kit** — confirmed by Aereon on 26 Sep 2026: show them, as logos,
  chosen for prestige and trust rather than how often each was invoiced. His list of recent work:
  Petronas Twin Towers, KL Tower, BYD, XPENG, JETOUR, Tesla, Tourism Malaysia, Singapore Tourism,
  Brunei Tourism, China Tourism, Shangri-La Hotel, CelcomDigi, Zhiyun, SmallRig, DJI, Insta360,
  Dubai Tourism, AirAsia MOVE, Hyatt Centric, Xiaomi, Huawei, Thailand Tourism, Ricoh, HONOR.
  The current selection lives in `lib/v3/brands.ts`.

## Evidence on Hand

- Invoice archive in Supabase: 185 invoices, 131 clients, March 2021 onward, with foreign-currency
  rows flagged.
- Instagram snapshot of 20 Sep 2026: 40 posts (23 Reels, 17 Feed), 29 Aug to 19 Sep 2026.
  Top post: the Petronas Twin Towers Merdeka Reel — 480,109 reach, 683,750 views, 36,176 likes.
  Merdeka content holds the top three positions.
- Follower demographics (age, gender, top 45 countries and cities) from Instagram, first stored
  2 Oct 2026: 71% aged 25–44, 56% in Malaysia, 13% in Kuala Lumpur; 98% of 30-day reach was
  non-followers. Shown on the Instagram tab and media kit v2.
- **Absent, must not be fabricated:** testimonials or quotes attributed to any client. Follower
  history began 20 Sep 2026 and grows with each snapshot.

## Product Principles

1. **His real numbers or nothing.** Never display invented, sample or placeholder figures as if
   they were his; where history does not exist yet, say so and show what will fill it.
2. **Answer the three questions first.** Everything else on a surface is secondary to on-track,
   audience growth and money owed.
3. **Income and quotations never mix.** A quoted figure must never read as money earned.
4. **Work performance means type of work, not just totals** — which kinds of jobs pay.
5. **The public page sells; the private pages inform.** The media kit persuades brands; the rest
   serves one operator and may be dense.
