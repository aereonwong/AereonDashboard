---
name: property-research
description: Investor market research for a property Aereon owns or is buying — collect asking prices and rents for nearby projects from PropertyGuru (later iProperty, Mudah, EdgeProp, Brickz transactions, Airbnb), store them in the git-ignored .market-data/ folder and the Supabase market_listing table, and report median price, psf, rent and gross yield against the subject unit. Use when Aereon says "research the market around X", "comps for my unit", "is this property worth it", "median rent near KLCC", "scrape PropertyGuru / iProperty / Brickz", or "update the market data".
---

# Property market research

Apart from the Property section (Aereon's own loans/tenancy). This is **market** data: other people's asking prices.
Never mix the two, and never feed it into the studio Dashboard.

## Folder

| What | Where |
|---|---|
| Transactions collector (plain fetch) | `scripts/market/collect-listmy.mjs` → `npm run market:listmy -- 50300 50450` |
| Listings collector (runs in Chrome) | `scripts/market/collect-propertyguru.js` |
| Ingest + report | `scripts/market/analyse.mjs` → `npm run market:analyse` |
| Load into Supabase | `scripts/market/import.mjs` → `npm run market:import -- --dry`, then without `--dry` |
| Maths + parsers (tested) | `lib/market-math.mjs`, `lib/market-listmy.mjs`, `tests/market-math.test.mjs` |
| Schema | `supabase/market.sql` (Aereon pastes it in the SQL editor once) |
| Data, reports, notes | `.market-data/` — git-ignored. `raw/` = collector files, `report-<date>.md`, `listings.json`, `subject.json` |

Aereon's purchase details (price paid, unit no., loan) go only in `.market-data/subject.json`, never in code or commits.

## Collecting — list.my transactions (start here)

Real subsale transactions per building (price, sqft, floor, month, unit type), server-rendered, robots.txt allows
`/subsales/…`. `npm run market:listmy -- <postcodes>` reads each postcode page, then every building's
`?view=list&group_by_size=false` page (all rows, no paging), one request every 3–4 s, stops on 403/429.
Postcodes around KLCC: 50300 Kampung Baru / Chow Kit, 50450 KLCC / Kia Peng / Stonor, 50250 Jalan Sultan Ismail /
Kg Baru edge, 50400 Jalan Tun Razak, 50088 KLCC itself. Watch for same-name buildings in other townships.
Transactions are the anchor; asking prices only show the current mood.

## Collecting — PropertyGuru asking prices (works, rate-limited)

Portals return **403 to scripts** (Cloudflare). Collection runs inside a normal tab in **Aereon's own Chrome**
(Claude in Chrome tools). Never solve or dodge a CAPTCHA / bot check — if a page comes back without data, stop and tell Aereon.

1. Open a propertyguru.com.my search page in a Chrome tab.
2. Paste the whole of `collect-propertyguru.js` with `javascript_tool`, then start it **without awaiting**
   (the tool times out at 45 s): `collectPropertyGuru(JOBS, {MAX_PAGES:160, DELAY:2500}).catch(e=>window.__marketErr=String(e)); 'started'`
3. Poll `({p: window.__marketProgress, r: window.__marketReport, e: window.__marketErr})` every few minutes (~15 s/page).
   Rows pile up in the site's localStorage (`marketRows`), so nothing is lost if it stops.
4. **Cloudflare shows "Just a moment…" (403) after ~45 pages in one go** (seen 18 Nov 2026). The collector then stops.
   Do not retry or try to get past it — wait (hours / next day) and resume with a smaller batch (≤ 30 pages, `DELAY: 8000`).
5. Save: open a NEW propertyguru tab (Chrome blocks a second automatic download from the same page), paste the file,
   run `saveMarketRows()` → one `market-pg-<date>.json` in ~/Downloads (save-to-Downloads approved by Aereon 18 Nov 2026).
6. `npm run market:analyse` moves it into `.market-data/raw/` and writes the report.

PropertyGuru location codes (district `kpycl` = KL City Centre):

| Area | areaCode | Notes |
|---|---|---|
| KLCC | `jgrve` | ~5,800 sale listings; cap with `&maxSize=1200` for single units |
| Kampung Baru | `ycr8z` | ~160 sale, smaller market; take all |
| Bukit Bintang | `03ift` | add when widening |

Job URLs: `/property-for-sale?districtCode=kpycl&areaCode=<code>[&maxSize=1200]` and the same with `/property-for-rent`.
Other areas: search with `freetext=` and read `additionalData.areaCode` from a listing. Pages are `/property-for-sale/2?…`.

Fields kept: id, url, kind, title (project), project id, new-launch flag, unit type, price, sqft, beds (-1 = studio),
baths, tenure, area, district, address, availability, lister type, posted date. **No agent names or phones.**

## Other sources (status 18 Nov 2026)

- **iProperty** — same group as PropertyGuru, mostly the same listings; skip unless PG misses a project.
- **Brickz** (transactions) — 403 to scripts and the Chrome tab bounced back to a blank page; list.my covers the same JPPH-style data.
- **EdgeProp** — 403 to scripts (its api.edgeprop.my news pages are open). **Mudah** — 403 on listing pages.
- Asking prices run above transacted prices — always say which one a figure is.
- **Airbnb / short-term** — AirROI and Airbtics publish citywide KL figures only (2025: ~29–43 % occupancy, ADR US$50–80).
  For KLCC: Airbnb search pages read fine in Aereon's Chrome (`/s/<Building>--Kuala-Lumpur/homes?checkin=…&checkout=…`
  shows "RM x for n nights" per listing). Next build: per comparable building, nightly rate for a weekday / weekend /
  peak date set, plus each listing's calendar (booked nights = occupancy proxy). Same pace + stop-on-check rules.

## Reading the numbers

- Asking price ≠ sold price. Report medians and p25/p75, never averages.
- psf = price / built-up sqft. Gross yield = (median rent psf × 12) / median sale psf. Net yield needs maintenance,
  sinking fund, management (Airbnb operators take 20–30 %), furnishing, vacancy.
- Comparable set for a single short-stay unit: studio / 1-bed, 350–650 sqft (`isStudioLike`). Compare a new launch against
  both resale listings of the same project (sub-sale premium/discount) and completed neighbours.
- New launches: developer price minus rebates is the real price; check tenure (freehold / leasehold / Malay reserve)
  — Kampung Baru has Malay-reserve land, which limits who can buy on resale.

## Do not

- Do not run the collector faster than one page every ~2.5 s, or more than ~400 pages a session.
- Do not commit anything from `.market-data/`, or Aereon's price/unit in code, comments, commits or PRs.
- Do not present listing medians as valuations.
