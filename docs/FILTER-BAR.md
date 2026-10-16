# Filter bar + scoped panels — the one way a v3 page filters

Aereon's rule (16 Oct 2026): **any page that lets you filter its figures uses this pattern.**
It was built for the Instagram Content Lab and is now the standard for every v3 page — Instagram,
Facebook, Social overview, Invoice Summary / Details, Clients, Dashboard, Property — and for any new one.
Read this before adding a filter, a date range, a segmented toggle that changes numbers, or a
"click a chart to drill in".

## The rules

1. **One bar, above everything it filters.** All of a page's filters live in a single toolbar row
   (`.v3-fbar`, `role="toolbar"`, `aria-label="Filter every panel"`). No filter buttons scattered
   inside panels, no second bar halfway down. Order: **timeline first**, then the dimensions
   (format, type, client, angle…), then the count + Reset on the right.
2. **Sticky on desktop, static on a phone.** The bar pins to the top while you scroll the panels it
   controls; under 720px it scrolls with the page (it would cover half the screen). A segmented row
   wider than the phone scrolls inside itself, never the page.
3. **Every panel says which filters it follows** — a dashed chip in its corner (`<Scope>` /
   `ScopedPanel scope=…`). Use these words:
   - `All filters` — follows everything in the bar.
   - `Ignores <filter>` — e.g. `Ignores format`, `Ignores angle & format`. Use this when the panel
     *is* that filter (a hook board shows every hook and highlights the chosen one).
   - `Timeline only` — follows the dates, not the other filters (e.g. account-wide figures that
     cannot be split by post).
   - `Account-wide · ignores filters` / `Last 30 days · ignores filters` — fixed figures.
   No number on the page may leave you wondering which slice it is.
4. **Fixed sections sit outside the bar's reach.** Figures that never follow the filters (account
   growth, audience demographics) go *above* the bar or under their own chapter with every panel
   marked `… · ignores filters`. Don't mix filtered and fixed panels without the chip saying so.
5. **Show the result size and a way back.** The right end of the bar shows how many items the
   slice holds (`98 posts`, `42 invoices`) with `aria-live="polite"`, and a **Reset** link whenever
   anything differs from the page's default.
6. **Charts can set filters, the bar shows it.** Clicking a bar, cell or row may set a filter
   (zoom a month, pick a hook); the bar then shows it as a removable accent chip (`.v3-fbar-chip`,
   "Aug 2026 ✕") or as the pressed option. Clicking the same thing again clears it.
7. **Defaults are deliberate.** Each page states its default slice in code (e.g. Instagram opens on
   the last 90 days) and in the headline/eyebrow (`Instagram · @aereonwong · Last 90 days`).
8. **The headline follows the slice.** If the page leads with a verdict sentence, compute it from
   the filtered data so it changes with the bar.
9. **Compare like with like.** A "vs before" figure compares the same-length stretch just before
   the slice, with the same non-date filters — and shows nothing (not a fall to zero) when there is
   no data before.
10. **Pick where the filtering happens — the look stays the same.** Two engines exist:
    - *In the browser* (Instagram): load the rows once, filter with `useMemo` — instant, best for
      post-level data and click-to-drill charts.
    - *In the URL* (`app/_v3/FilterBar.tsx` + `lib/v3/filters.ts`, used by Dashboard, Invoices,
      Clients): the bar rewrites the query string and the server redraws — bookmarkable, and the
      money maths stays in one server-side place. Keep money pages on this one.
    Either way: same bar styling, same scope chips. Money stays masked (MoneyMask) and viewers can
    still filter (filtering is not editing).

## Building blocks

| Piece | Where |
|---|---|
| Bar styles: `.v3-fbar`, `.v3-fbar-group`, `.v3-fbar-label`, `.v3-fbar-select`, `.v3-fbar-chip`, `.v3-fbar-count`, `.v3-fbar-reset` | `app/_v3/filterbar.css` |
| Segmented buttons inside the bar | `.v3-seg` with `aria-pressed` (v3.css) |
| Panel with the corner chip | `app/_v3/ScopedPanel.tsx` — `<ScopedPanel id title note scope span>`; `<Scope>` for a chip alone. Server-safe. |
| Reference implementation | `app/_v3/pages/ContentLab.tsx` (the Instagram page) |

Skeleton:

```tsx
<div className="v3-fbar" role="toolbar" aria-label="Filter every panel">
  <div className="v3-fbar-group">
    <span className="v3-fbar-label">Timeline</span>
    <div className="v3-seg">{/* buttons with aria-pressed */}</div>
  </div>
  <div className="v3-fbar-group">
    <label className="v3-fbar-label" htmlFor="f-type">Type</label>
    <select id="f-type" className="v3-fbar-select">…</select>
  </div>
  <div className="v3-fbar-count" aria-live="polite">
    <b className="num">{rows.length}</b> invoices
    {changed ? <button type="button" className="v3-fbar-reset" onClick={reset}>Reset</button> : null}
  </div>
</div>

<ScopedPanel id="by-month" span={8} title="Income by month" scope="All filters">…</ScopedPanel>
<ScopedPanel id="who" span={4} title="Who follows" scope="Account-wide · ignores filters">…</ScopedPanel>
```

## Pages still on older filters

These predate the rule. When a change touches one, bring its bar to `.v3-fbar` (sticky, count +
Reset) and give its panels scope chips — don't rebuild them unasked:
- `app/_v3/FilterBar.tsx` — Dashboard, Invoice Summary / Details, Clients (URL engine; keep it).
- `app/_v3/FbFilters.tsx` — Facebook. `app/_v3/SocialFilters.tsx` — Social overview.
- `app/_v3/NewsFilters.tsx` — News.
