# Social analytics — Instagram, Facebook, TikTok, /social, public numbers

<!-- Moved out of the root CLAUDE.md on 30 Oct 2026 so it loads only when needed. Unchanged text. -->

## Instagram data

- Instagram lives in its own `ig_snapshots` table, one row per refresh. Instagram caps a media page
at ~40 posts for this field set — asking for 50 silently returns zero, so never raise the cap.
History (added 2 Oct 2026, `supabase/instagram-history.sql`): `ig_post_metrics`,
`ig_account_snapshots`, `ig_account_daily`. Fetching lives in `lib/ig-fetch.ts` — no runtime
imports, so `scripts/ig-refresh.mjs` loads the same file. Insight metrics differ per format
(Reels: watch time; posts: follows, profile visits) — asking for an unsupported one fails the call.
**Archive (7 Oct 2026, `supabase/instagram-archive.sql`, `npm run ig:backfill`):** every post ever
(`ig_posts`) with insights in `ig_post_metrics`, account totals per 30-day window back to Oct 2024
(`ig_account_periods`) and daily reach back as far (`ig_account_daily`). For analytics, read these
tables first; only ask Instagram again when a refresh is actually needed. Reach and accounts_engaged
are unique per window — never add windows' reach together.
"Typical post" means the MEDIAN reach (`analyse()` in `lib/instagram.ts`), never the mean.

## Facebook — the Aereon Wong Page (added 12 Oct 2026)

`/facebook` (v3 Social group beside Instagram; classic layouts get the same page in a v3 frame) and a combined
Instagram + Facebook band on the v3 Dashboard ("Is my audience growing"; the top KPI becomes "Social reach").
- Connection: Composio project auth config `facebook-dashboard`, user `aereon` (OAuth done by Aereon 12 Oct 2026).
  Page id `835556219912496` (public; `FB_PAGE_ID` overrides). The connection can also see "Discover Kuala Lumpur" — not used.
- Tables (`supabase/facebook.sql`): `fb_page_daily` (one row per day: followers, follows, unfollows, views, viewers,
  engagements, video views — back to Aug 2024 for views), `fb_page_periods` (rolling 28-day totals per day, Facebook's
  own unique count), `fb_posts`, `fb_post_metrics` (+ view `fb_post_latest`).
- Meta retired impressions/reach on 15 Nov 2025: **views** = every showing (additive), **viewers** = unique people,
  true only per day or per 28-day window — never add viewers across days, windows or posts. Typical post = median viewers.
- Fetch in `lib/fb-fetch.ts` (no imports, shared with `scripts/fb-backfill.mjs`), refresh in `lib/fb-refresh.ts`,
  read + maths in `lib/facebook.ts`. Two Graph quirks, both answer EMPTY instead of failing: all seven daily
  metrics in one 89-day call (asked in groups of ≤3), and a heavy page of posts (paging starts at 25 and halves).
- The daily `cron-instagram` (6am MYT) refreshes Facebook too (last 10 days + posts of the last 30 days); the
  Refresh button on the page calls `/api/facebook/refresh`. `npm run fb:backfill` (Mac, Composio CLI via
  `composio dev playground-execute` against the project) fills history: page figures from Aug 2024, posts from 1 Jan 2025.
- Combined figures add platforms, so someone on both counts twice — the UI says so. Empty in demo mode.

## TikTok — @aereon.wong (added 17 Oct 2026)

`/tiktok` (v3 Social group after Facebook; classic layouts get it in a v3 frame) and a TikTok block in the v3 Dashboard's
"Is my audience growing" band (TikTok joins the combined followers and posting figures, never reach).
- Connection: Aereon's own TikTok developer app "Aereon Dashboard" in **Sandbox** (target user aereon.wong; scopes
  user.info.basic/profile/stats + video.list) → Composio project custom auth config `tiktok-dashboard`, user `aereon`.
  If calls start failing, check the sandbox target user first.
- What TikTok gives: account totals today (followers, following, likes, video_count) and each PUBLIC video's lifetime
  views/likes/comments/shares. **No reach, watch time, audience or day-by-day history** — history is our own readings.
- Tables (`supabase/tiktok.sql`): `tt_account_daily` (one row per Malaysia day), `tt_posts`, `tt_post_metrics`
  (+ view `tt_post_latest`). `cover_url` is a TikTok CDN link that expires within about a day — a convenience only,
  refreshed for recent videos; older videos show the grey frame.
- Fetch in `lib/tt-fetch.ts` (no imports, shared with `scripts/tt-backfill.mjs`), refresh in `lib/tt-refresh.ts`, read +
  maths in `lib/tiktok.ts`. TikTok's envelope: `data.data.{user|videos,cursor,has_more}`, `data.error.code === "ok"`.
  Videos page 20 at a time; `cursor` is a create time in ms.
- The daily `cron-instagram` refreshes TikTok after Facebook (account + videos of the last 100 days — the public 90-day total needs every one re-read within the week); the Refresh button
  calls `/api/tiktok/refresh` (signed-in editors, 10-minute cooldown). `npm run tt:backfill` stores every public video.
- Typical video = MEDIAN views. Followers' 30-day change shows only once our readings reach back 30 days.
- Public totals (`socialTotals()`): TikTok adds its followers and, for views/interactions, the videos posted in the last
  90 days at their latest reading (TikTok has only lifetime counts per video). TikTok sits out of reach totals.
  Empty in demo mode.

**Social overview — every platform (17 Oct 2026, reworked same day for scale).** `/social` and the v3 Dashboard's
"Is my audience growing" band share one maths (`buildSocial()` in `lib/v3/social-math.ts`, pure + tested in
`tests/social.test.mjs`) and one set of parts (`app/_v3/SocialOverview.tsx`, charts in `PlatformChart.tsx`).
- **Platform registry `lib/v3/platforms.ts`** — the only place a platform is named (id, name, href, noun, whether it has
  its own unique-people figure). YouTube (`yt`), Threads (`th`), Xiaohongshu (`xhs`) are reserved. Adding one = its
  fetch/refresh/tables + an adapter in `lib/v3/social.ts` returning a `Source` (see `igSource`/`fbSource`/`ttSource`) +
  its page and nav lines; every table, chart, legend, filter and total picks it up.
- **Views & interactions = each platform's OWN count for the window** (Aereon, 18 Oct 2026: Stories and ads are part
  of the analytics). `Source.reported[days]`: Instagram's account totals for 30 and 90 days (posts, Reels, Stories,
  ads); Facebook's Page daily totals added over 30/90/365 whole days. A platform/window with no account count (TikTok
  always; Instagram for 12 months) uses the views of the posts published in the window — `basis: 'posts'`, and the
  label says so. Engagement rate = those interactions per 100 views. Typical post (median views), hits (2×) and the
  ranking (lift over the platform's own typical) always read the posts published in the window.
- People reached = each platform's own unique window (IG 30d, FB 28d), added only as a platform total and only across
  platforms that measure it. Unread posts sit out of sums and are counted. A reading over a week old is flagged.
- Dashboard hero's 4th KPI = followers on every platform (+30-day change, naming which platforms have the history).
- Charts: views by posting month (stacked), followers GAINED in 90 days (indexed to each platform's first reading —
  absolute lines tens of thousands apart flatten each other), people reached per day, posts per week.
- **Colour: one fixed slot per platform** (`--p-ig` … `--p-xhs` in `app/_v3/v3.css`, applied with `data-p`), validated
  with the dataviz validator in light and dark; never coloured text, never a generated 7th hue.
`readIgPosts()` adds the daily snapshot's newest posts that the `ig_posts` archive hasn't caught up with.

**Instagram — one page since 16 Oct 2026** (`app/_v3/pages/ContentLab.tsx` + `lab.css`, maths in `lib/v3/lab-math.ts`,
read in `lib/v3/content-lab.ts`; the Studio/Lab view switch and `cfo-ig` cookie are gone). Top to bottom: verdict headline,
Growth (account-wide, Studio panels, ignores filters), the sticky filter bar, the post analysis, Timing, Audience, the ranked posts.
Post figures read THIS YEAR's posts only (from 1 Jan, Malaysia time — Aereon's call) with each post's latest
`ig_post_metrics` reading, filtered in the browser: timeline (opens on the last 90 days — or the year so far when that
is shorter; also year / 30 days / a month, or click a bar), format, angle, hook. Only "Reach over time" keeps the whole
year, as context. Hook = the caption's first line, classified by `HOOKS` (first match wins); angle by `angleOf`; brand
placement by `brandOf`. Typical = median; hit = 2× the slice's typical. Post panels are empty in demo mode.
Ranked posts show a small cover: the snapshot's own image for its ~40 newest posts, else
`/api/instagram/cover?code=<shortcode>` (signed-in only, shortcodes in `ig_posts` only, nothing stored, no Composio call),
else a format tile; tapping a cover plays the post in Instagram's embed player.

## Public proof numbers (16 Oct 2026; one basis + stored since 18 Oct 2026)

Landing (reel + classic), both media kits, `/hello` and its share card show ONE overall figure per stat across every
connected platform — `socialTotals()` in `lib/social-totals.ts`. Labels never name platforms or explain double counting
(Aereon's call). **Same maths as /social and the Dashboard** (`lib/v3/social-math.ts`): views/interactions = each
platform's own 90-day count (Stories and ads in; TikTok: its videos of the 90 days); engagement = interactions per 100 views (30 days); reach = each
platform's own latest month of unique people, best reach = its best month in 90 days — added across platforms, never
across windows. **Stored, not recomputed:** `writeSocialTotals()` writes one row per platform per window (30, 90) plus
`all` into `social_totals` (`supabase/social-totals.sql`) for 30, 90 and 365 days, and the whole /social picture per
window into `social_snapshots` (`supabase/social-snapshots.sql`, jsonb of `trimSocial(buildSocial())`) after the 6am cron, after any Refresh button, and from
`POST /api/social/totals` (editors; reads our tables only). The public pages, /social and the Dashboard's audience band (`readSocial(days)`)
read the newest stored day — nothing is recalculated on a page load; only if none is under 2 days old do they compute
on the spot (held 10 minutes, not stored). Demo mode never reads the stored real figures. A stale or unread platform makes that `all` total null → tile hides.

