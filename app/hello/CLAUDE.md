# Link page — /hello

Also applies to `lib/hello*.ts`, `lib/socials.ts`, `app/(app)/links/` and `/api/track`.

## Link page — /hello (added 11 Oct 2026)

The link in Aereon's Instagram bio: `aereonwong.com/hello` (`app/hello/`, public, tracked in `site_visits`).
Phone-first, one screen: photo band with a CSS-only intro (flight line draws, then blocks rise; off for
reduced motion), a proof strip (overall views + interactions over 90 days across every connected platform, via `socialTotals()` in
`lib/social-totals.ts` — a platform over 7 days stale drops out — and followers across all platforms; labels never name
platforms, "All socials"; Aereon's call, 11/14/16 Oct 2026), social icons from `lib/socials.ts`, then **"What brings you here?"** (`app/hello/Chooser.tsx`):
tiles for five audiences — `collab`, `shoot` (visiting KL / local business), `drone`, `deals` (attractions &
promos), `gear` — each opening only its section, addressable as `/hello#<id>` for Stories (CSS `:target` is the
no-JS fallback). Every email button is a mailto `EMAIL` with a brief for that audience (`briefMailto`); a Copy
button sits beside them because Instagram's in-app browser often can't open mail. Plain links live in the
collab section. **Affiliate links** carry `kind` deal|gear (missing = deal), a disclosure line,
`rel="sponsored"` and an optional discount code; a deals/gear tile is hidden while it has no links.
Edited on the **Link page** tab (`/links`, Social group after News; also linked from Settings): tagline,
collab text, topics, services intros, links and affiliates (add, edit, reorder, hide, delete, section — `ListEditor.tsx` serves both).
Stored as one `records` row (`doc` / `setting` / title `hello`) like the site settings — no table.
`lib/hello-config.ts` cleans every save and read (http(s)/mailto only; one id space across both lists).
**Tap tracking:** elements with `data-t` (`tap/<section>`, `out/<link id | mail-* | social-* | code-* | copy-email>`)
send a beacon via `app/hello/TapTracker.tsx` to `/api/track`, logged in `site_visits` as `/hello/tap/…` / `/hello/out/…`
(`HELLO_EVENT` in `lib/site-visits.ts`, which also takes `/hello/scroll/…` and `/hello/time/…` for the bot filter; same no-IP, no-owner, no-bot, 10-minute de-dupe rules). Since 16 Oct 2026 the Link page tab
is setup only; insights live on **Site analytics** (`/analytics/link`, `app/(app)/analytics/link/`), which shows (`lib/hello-stats.ts` reads, `lib/hello-insights.ts` is the tested maths): 7/30/90-day switch, visitors (daily
hash, so one person on two days counts twice), funnel (opened a section / started an email / opened a promo / went
to a social), per-section opened → acted, taps, sources (in-app browser from `parseUa` — Instagram, Threads, Facebook,
TikTok, Xiaohongshu, LINE — split by Aereon's own `utm_source` tag, e.g. "Instagram · bio" (the app's own `ig` tag doesn't
split); else the tag, with short tags like `ig` named; else referrer). Bio link: `aereonwong.com/hello?utm_source=bio`), countries, cities, devices. **Share card:** `app/hello/opengraph-image.tsx` (+ `twitter-image.tsx`), rebuilt
every 6 hours; `/hello` is a public PREFIX so these image routes are reachable. Tourist shoots show `shootFrom`
("From USD 150", editable).
