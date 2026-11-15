## Dashboard v3 — the creator studio

A whole-app version chosen per device in Settings (cookie `cfo-dash=v3`; the default) beside v1 and v2.
One look: **Studio Standard** (`data-world="canon"`). Contact Sheet and Flight HUD were removed on
3 Oct 2026 at Aereon's request — don't reintroduce `[data-world="hud"|"contact"]` rules or a world picker;
an old `cfo-v3` cookie or saved site `world` is ignored. The design system is in **`DESIGN.md`** at the
repo root (the Studio Standard sections apply; the others are history) — one accent at a time (indigo by
default; Settings offers skyline, lagoon, golden, orchid, graphite via `html[data-v3accent]`), green/red
are for status only. `PRODUCT.md` holds the product truths it answers to. The public media kit is switched on
site-wide in Settings; `/?preview=kit` previews it when signed in.

What lives where: Dashboard = the daily pulse; Invoice Summary = the deep money analysis
(`lib/v3/summary.ts`); Invoice Details = the table and its actions; Instagram = audience and content;
Clients = relationships. Analytics or design changes cover all five together.

**Filters (16 Oct 2026, Aereon's rule):** every page that filters its figures uses ONE sticky filter bar
above what it filters, and every panel carries a corner chip saying which filters it follows
(`ScopedPanel`, `filterbar.css`). Read `docs/FILTER-BAR.md` before adding or changing any filter.

**Charts (17 Oct 2026, Aereon's rule):** every chart answers the mouse — hover lights the mark and a
readout says what it is. Server-drawn charts add `data-tip`; client charts keep `.v3-tip`. Read
`docs/CHARTS.md` before adding or changing one.

**Never:** build new UI in v1/v2 · add a second accent colour to one screen · use green/red for anything
but status · compute a money figure inside a component (it comes from `lib/`) · show real money while
amounts are hidden (`.v3-locked`, `docs/PRIVACY-MODE.md`) · change one of the five pages' analytics or
look without carrying it across the other four.

**Before shipping a v3 change:** `build-verifier` on the pages touched, `theme-qa` if CSS, a chart or
shared UI changed (6 accents × light/dark + mobile), `numbers-guard` if a figure moved.
