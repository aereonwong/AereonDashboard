# Charts answer the mouse

Aereon's rule (17 Oct 2026): **every chart is interactive on hover.** Point at a bar, cell, dot,
slice or column and it lights up (the rest quiet down) and a readout says exactly what it is.
A finger tap does the same; a tap elsewhere hides it. No chart ships with only the browser's slow
`title` popup, or with nothing.

## How — pick one

1. **Server-drawn chart (most v3 panels): add `data-tip`.** Nothing else — no `'use client'`, no state.
   `app/_components/ChartTips.tsx` (mounted once in `app/(app)/layout.tsx`) shows the card and marks
   the hovered element `data-tip-on`; `globals.css` (`.chart-tip`, `[data-tip-on]`) dims its siblings.

   ```tsx
   <li data-tip={`${label}\n${fmt(value)} visitors\n${pct} of the week`}>…</li>
   ```

   Line 1 = muted heading (what it is: the day, month, client). Lines 2+ = the figures, line 2 bold.
   A single `"Label: figure"` line is split the same way. Use `data-tip` **instead of** `title`
   (never both — two popups). Put it on the whole hover target (the column / row / cell), not on a
   2px-wide child, so it is easy to hit.

2. **Client chart with its own scrub (TrendBars, SeriesChart, PaceChart, SocialDaily, LoanChart,
   RelationshipMap, GrowthRhythm, the Instagram page's `lab-tip`):** keep its `.v3-tip` / `.lab-tip` —
   they share the same card look (film background, blur, line-2 border, soft shadow).

3. **Ranked rows with a bar (`.v3-row` + `.v3-row-bar`):** the value is already printed on the row;
   CSS gives the hover highlight automatically. Add `data-tip` only if the row hides something.

## Must

- Money in a readout goes through the usual formatters (`rmFull`, `compact`). `MoneyMask` masks
  `data-tip` like `title`, so hidden amounts stay `RM *****` in the card too.
- Say the unit and the window ("visitors", "reached", "of the last 12 months"); a bare number is not
  a readout.
- Reduced motion: transitions are dropped, the readout still shows.
- Public pages (landing, `/hello`, media kits) don't mount ChartTips; their bars print their values.
