## Dashboard v3 — the creator studio

A whole-app version chosen per device in Settings (cookie `cfo-dash=v3`; the default) beside v1 and v2.
One look: **Studio Standard** (`data-world="canon"`). Contact Sheet and Flight HUD were removed on
3 Oct 2026 at Aereon's request — don't reintroduce `[data-world="hud"|"contact"]` rules or a world picker;
an old `cfo-v3` cookie or saved site `world` is ignored. The design system is in **DESIGN.md** (the
Studio Standard sections apply; the others are history) — indigo is the only accent, green/red are for
status. `PRODUCT.md` holds the product truths it answers to. The public media kit is switched on
site-wide in Settings; `/?preview=kit` previews it when signed in.

What lives where: Dashboard = the daily pulse; Invoice Summary = the deep money analysis
(`lib/v3/summary.ts`); Invoice Details = the table and its actions; Instagram = audience and content;
Clients = relationships. Analytics or design changes cover all five together.
