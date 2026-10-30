# Site analytics and the /mediakit deck

<!-- Moved out of the root CLAUDE.md on 30 Oct 2026 so it loads only when needed. Unchanged text. -->

## Site analytics (16 Oct 2026)

**Site analytics** is its own nav group (after Social): who visits the public pages and what they do —
`/analytics/landing` (Landing page, `/`) and `/analytics/link` (Link page, `/hello`), 7/30/90 days; `/analytics` redirects. `/links` is setup only. All from `site_visits` via `/api/track` (no IP, daily
visitor hash, owner and bots never counted). The landing logs `/land/…` events (`LANDING_EVENT` in `lib/site-visits.ts`)
from `app/_components/LandingTracker.tsx`: version seen, scroll 25–100%, visible time 10s–10m, browser language, and
every tap — named from `data-t` or the link's target by `lib/landing-taps.ts`, so all landing versions are covered.
Maths `lib/landing-insights.ts` (tested), read `lib/site-stats.ts`. **Bot filter** (`splitBots` in
`lib/hello-insights.ts`, both pages, from `CHECKS_FROM` = 17 Oct 2026): a daily visitor counts only if they scrolled,
stayed 10s+ visible, tapped, or opened the page in an app (Instagram, Facebook…); the rest — crawlers that run JS from
data-centre cities (Council Bluffs, Ashburn, Boardman) and instant bounces — are shown only as a "left out" count.
/hello sends the same scroll/time signals (`EngagementTracker`).

## Client media kit deck — /mediakit (18 Oct 2026)

Public and searchable (in the sitemap and llms.txt; Aereon's call, 18 Oct) 9-slide deck at `aereonwong.com/mediakit`:
static files in `public/mediakit/` (index.html, images, `og.jpg` share card, the PDF), served by a rewrite in
`next.config.ts` and listed in `PUBLIC_PREFIX` (`lib/agent-site.ts`; bump `KIT_UPDATED` there when the deck changes).
Built by hand outside the app (HTML → Chrome PDF), so its figures are a dated snapshot, not live; per-platform follower
numbers are shown here on purpose (Aereon's call for the client deck). To update: edit `index.html`, re-export the PDF.
Linked from the nav (Social → Media kit), every landing version's top bar (`kit-top`; the classic CTA row has `kit-cta`) and /hello's "Media Kit" link
(id `kit`, a stored link edited on /links, pointed at `/mediakit?utm_source=hello` on 18 Oct).
**Analytics:** the page's own inline script sends `/mediakit` + `/kit/…` beacons (`KIT_EVENT` in `lib/site-visits.ts`:
slides seen, scroll, time, language, taps — `work-<post>`, `pdf`, `mail`, socials); read on Site analytics →
Media kit (`/analytics/mediakit`, maths `lib/kit-insights.ts`, tested). Keep `KIT_SLIDES` in step with the deck.
**Private share links (19 Oct 2026):** on that page Aereon types a brand and gets `aereonwong.com/mediakit?r=<6 random
chars>` (`lib/kit-links-config.ts`: no 0/o/1/l/i). Code → brand lives only in one `records` row (doc / setting /
title `kit-links`; read `lib/kit-links.ts`, saved by `lib/kit-links-actions.ts`, owner/admin only). The deck sends the
code in the `utm_source` column; `analyseKit(…, names)` swaps it for the brand under sources and counts each link's
visitors / reached Contact / posts / PDF / email. Brand names must never reach the public page.

