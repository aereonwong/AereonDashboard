# Link page — /hello

The link in Aereon's Instagram bio: `aereonwong.com/hello?utm_source=bio` (added 11 Oct 2026).
Public, phone-first, one screen. Also applies to `lib/hello*.ts`, `lib/socials.ts`,
`app/(app)/links/` and `/api/track`.

## Never

- Never name a platform beside the proof numbers, and never add a "counts twice" note there — one
  overall figure, labelled "All socials" (Aereon's call, 11/14/16 Oct 2026). Rules: `docs/SOCIAL.md`.
- Never show a partial total: a stale platform hides the total.
- Never store an IP, the owner's own visits or bot visits in `site_visits`.
- Never save a link that is not `http(s):` or `mailto:` — `lib/hello-config.ts` cleans every save
  and every read; don't bypass it.
- Never drop the disclosure line or `rel="sponsored"` from an affiliate link.
- Never add a table for this page's settings — it is one `records` row.
- Never make the page depend on JavaScript to open a section (CSS `:target` is the fallback), and
  never animate without honouring reduced motion.

## The page (`app/hello/`)

Top to bottom:

1. **Photo band** with a CSS-only intro: the flight line draws, then blocks rise. Off for reduced motion.
2. **Proof strip**: overall views + interactions over 90 days, and followers, across every
   connected platform — `socialTotals()` in `lib/social-totals.ts`, read from the stored
   `social_totals` table.
3. **Social icons** from `lib/socials.ts`.
4. **"What brings you here?"** (`Chooser.tsx`): tiles for five audiences, each opening only its
   own section, addressable as `/hello#<id>` for Stories.

   | id | Audience |
   |---|---|
   | `collab` | brands — plain links live here |
   | `shoot` | visiting KL / local business; shows `shootFrom` ("From USD 150", editable) |
   | `drone` | drone work |
   | `deals` | attractions & promos (affiliate links, `kind: 'deal'`) |
   | `gear` | gear (affiliate links, `kind: 'gear'`) |

   A deals or gear tile is hidden while it has no links.
5. **Email buttons**: each is a mailto to `EMAIL` with a brief written for that audience
   (`briefMailto`). A **Copy** button sits beside each, because Instagram's in-app browser often
   cannot open mail.
6. **Affiliate links** carry `kind` deal|gear (missing = deal), a disclosure line,
   `rel="sponsored"` and an optional discount code.

**Share card:** `app/hello/opengraph-image.tsx` (+ `twitter-image.tsx`), rebuilt every 6 hours.
`/hello` is a public PREFIX in `lib/agent-site.ts` so these image routes are reachable.

## Editing it — the Link page tab (`/links`)

Social group, after News; also linked from Settings. Setup only since 16 Oct 2026. Edits: tagline,
collab text, topics, services intros, links and affiliates (add, edit, reorder, hide, delete,
section — `ListEditor.tsx` serves both lists).

Stored as one `records` row (`doc` / `setting` / title `hello`), like the site settings.
`lib/hello-config.ts` cleans every save and read: http(s)/mailto only, one id space across both lists.

## Tap tracking

Elements with `data-t` send a beacon through `app/hello/TapTracker.tsx` to `/api/track`:

| `data-t` | Logged in `site_visits` as |
|---|---|
| `tap/<section>` | `/hello/tap/…` |
| `out/<link id \| mail-* \| social-* \| code-* \| copy-email>` | `/hello/out/…` |

`HELLO_EVENT` in `lib/site-visits.ts` also accepts `/hello/scroll/…` and `/hello/time/…` (used by
the bot filter). Same rules as page visits: no IP, no owner, no bots, 10-minute de-dupe.

A new button or link on the page is not done until it has a `data-t`.

## Insights — Site analytics (`/analytics/link`)

`app/(app)/analytics/link/`; `lib/hello-stats.ts` reads, `lib/hello-insights.ts` is the tested maths
(`tests/hello.test.mjs`). Rules for all site analytics: `docs/SITE-ANALYTICS.md`.

- 7 / 30 / 90-day switch.
- **Visitors** use a daily hash, so one person on two days counts twice — label accordingly.
- **Funnel**: opened a section / started an email / opened a promo / went to a social.
- Per-section opened → acted; taps; countries, cities, devices.
- **Sources**, in this order: the in-app browser from `parseUa` (Instagram, Threads, Facebook,
  TikTok, Xiaohongshu, LINE), split by Aereon's own `utm_source` tag — e.g. "Instagram · bio" (the
  app's own `ig` tag does not split); else the tag, with short tags like `ig` given a name; else
  the referrer.

## Check before shipping a change here

- `npm test` (hello config + insights maths).
- Open `/hello` at 390×844: one screen, each tile opens only its section, `/hello#deals` lands on it.
- With JavaScript off, `/hello#collab` still opens the section.
- `security-reviewer` if `/api/track` or `lib/hello-config.ts` changed; `ig-guard` if the proof
  strip changed.
