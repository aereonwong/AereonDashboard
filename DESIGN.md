---
name: Aereon Studio v3
description: Creator studio. One shared structure, three visual worlds (Contact Sheet, Flight HUD, Studio Standard) chosen by data-world on the .v3 root.
colors:
  contact-ground: "#0D0D0D"
  contact-film: "#161616"
  contact-film-2: "#1E1E1E"
  contact-print-white: "#EDEAE3"
  contact-ink-2: "#B4B0A6"
  contact-ink-3: "#85817A"
  contact-line: "rgba(237, 234, 227, 0.14)"
  contact-line-2: "rgba(237, 234, 227, 0.26)"
  contact-china-marker: "#E4322B"
  contact-marker-soft: "rgba(228, 50, 43, 0.14)"
  contact-marker-blush: "#FFD1CE"
  contact-edge-amber: "#F2B544"
  hud-ground: "#05080D"
  hud-scrim: "rgba(5, 8, 13, 0.55)"
  hud-scrim-2: "rgba(5, 8, 13, 0.72)"
  hud-stroke-white: "#F4F7FA"
  hud-ink-2: "rgba(244, 247, 250, 0.72)"
  hud-ink-3: "rgba(244, 247, 250, 0.50)"
  hud-edge: "rgba(244, 247, 250, 0.62)"
  hud-line: "rgba(244, 247, 250, 0.22)"
  hud-line-2: "rgba(244, 247, 250, 0.40)"
  hud-nominal-green: "#2BD9A1"
  hud-caution-yellow: "#FFD60A"
  hud-alert-red: "#FF453A"
  canon-ground: "#F7F7F8"
  canon-surface: "#FFFFFF"
  canon-surface-2: "#FAFAFA"
  canon-ink: "#0A0A0B"
  canon-ink-2: "#52525B"
  canon-ink-3: "#71717A"
  canon-line: "#E4E4E7"
  canon-line-2: "#D4D4D8"
  canon-indigo: "#5B5BD6"
  canon-indigo-soft: "rgba(91, 91, 214, 0.10)"
  canon-pos: "#15803D"
  canon-neg: "#DC2626"
  canon-dark-ground: "#0A0A0B"
  canon-dark-surface: "#111113"
  canon-dark-surface-2: "#18181B"
  canon-dark-ink: "#FAFAFA"
  canon-dark-ink-2: "#A1A1AA"
  canon-dark-ink-3: "#8B8B94"
  canon-dark-line: "#27272A"
  canon-dark-line-2: "#3F3F46"
  canon-dark-indigo: "#8B8CF7"
  canon-dark-indigo-soft: "rgba(139, 140, 247, 0.14)"
  canon-dark-pos: "#4ADE80"
  canon-dark-neg: "#F87171"
typography:
  contact-figure:
    fontFamily: "Caveat Brush, Barlow, cursive"
    fontSize: "clamp(4.5rem, 10.5vw, 10.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  contact-note:
    fontFamily: "Caveat Brush, Barlow, cursive"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.1
  contact-headline:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  contact-title:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.03em"
  contact-body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  contact-edge-code:
    fontFamily: "Share Tech Mono, ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    letterSpacing: "0.08em"
  hud-readout:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 5.4vw, 4.4rem)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  hud-headline:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.08em"
  hud-title:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  hud-label:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
    letterSpacing: "0.16em"
  hud-body:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  canon-headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  canon-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.2
  canon-kpi:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "1.625rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  canon-body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  canon-label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  hud: "0px"
  contact: "2px"
  canon-bar: "4px"
  canon: "10px"
  canon-container: "14px"
  pill: "99px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  space-7: "48px"
  space-8: "72px"
components:
  button-contact:
    backgroundColor: "transparent"
    textColor: "{colors.contact-print-white}"
    rounded: "{rounded.contact}"
    padding: "6px 11px"
  button-primary-contact:
    backgroundColor: "{colors.contact-print-white}"
    textColor: "{colors.contact-ground}"
    rounded: "{rounded.contact}"
    padding: "6px 11px"
  button-primary-hud:
    backgroundColor: "{colors.hud-stroke-white}"
    textColor: "{colors.hud-ground}"
    rounded: "{rounded.hud}"
    padding: "6px 11px"
  button-primary-canon:
    backgroundColor: "{colors.canon-indigo}"
    textColor: "{colors.canon-surface}"
    rounded: "{rounded.canon}"
    padding: "6px 11px"
  button-kit-cta-canon:
    backgroundColor: "{colors.canon-indigo}"
    textColor: "{colors.canon-surface}"
    rounded: "{rounded.canon}"
    padding: "12px 20px"
  chip-selected-contact:
    backgroundColor: "{colors.contact-marker-soft}"
    textColor: "{colors.contact-print-white}"
    rounded: "{rounded.contact}"
    padding: "6px 11px"
  chip-selected-canon:
    backgroundColor: "{colors.canon-indigo-soft}"
    textColor: "{colors.canon-ink}"
    rounded: "{rounded.canon}"
    padding: "6px 11px"
  segment-pressed-hud:
    backgroundColor: "transparent"
    textColor: "{colors.hud-stroke-white}"
    rounded: "{rounded.hud}"
    padding: "6px 11px"
  panel-contact:
    backgroundColor: "{colors.contact-film}"
    rounded: "{rounded.contact}"
    padding: "38px 24px"
  panel-hud:
    backgroundColor: "{colors.hud-scrim}"
    rounded: "{rounded.hud}"
    padding: "24px"
  panel-canon:
    backgroundColor: "{colors.canon-surface}"
    rounded: "{rounded.canon}"
    padding: "24px"
  kpi-canon:
    backgroundColor: "{colors.canon-surface}"
    textColor: "{colors.canon-ink}"
    rounded: "{rounded.canon}"
    padding: "16px 24px"
    typography: "{typography.canon-kpi}"
  nav-item-contact:
    textColor: "{colors.contact-ink-2}"
    rounded: "{rounded.contact}"
    padding: "6px 12px"
  nav-item-active-canon:
    backgroundColor: "{colors.canon-indigo-soft}"
    textColor: "{colors.canon-indigo}"
    rounded: "{rounded.canon}"
    padding: "6px 12px"
  mobile-nav-pill-active-canon:
    backgroundColor: "{colors.canon-ink}"
    textColor: "{colors.canon-ground}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  month-frame-contact:
    backgroundColor: "{colors.contact-print-white}"
    textColor: "{colors.contact-ground}"
    rounded: "{rounded.hud}"
    padding: "8px"
---

# Design System: Aereon Studio v3

## Overview

**Creative North Star: "One Studio, Three Lenses"**

v3 is the creator studio: a whole-app version, opt-in in Settings beside v1 and v2. One structure (a left rail, a page head, a filter bar, a 12-column panel grid, a month strip, lists, tables, charts) is shared by three visual worlds, and the world is chosen by `data-world` on the `.v3` root: `contact` (Contact Sheet), `hud` (Flight HUD) and `canon` (Studio Standard). Every world token and override is scoped under `.v3`, so v1 and v2 never see it. The worlds differ in ground, ink, type, corner, panel material and one signature interaction each; they never differ in layout, data, filters or copy.

All three worlds sit over the same photograph, his own KLCC Merdeka night shot, at three strengths: a blurred backlight for the light table (30% opacity, 3px blur), a near-full-strength live feed for the HUD (62%), and a faint watermark behind a clean surface for the Standard (8%, part-greyscale). Each world takes its colour, type and marks from its own objects: film stock, contact prints and a china marker; drone telemetry; the category's own analytics dashboards, played straight.

The boundary: v1 and v2 keep the classic look in `app/globals.css` (12 accent palettes, 4 typefaces, a warm-paper default). That system is not part of this document. Where a classic page or component is drawn inside the v3 shell (Cash In, Leads, Tasks and the rest), it inherits the active world through mapped variable names (see Colors).

Where the build differs from the direction contract, this document records the build:

- **HUD tape scrub:** built as contracted. Pressing on the month timeline captures the pointer and dragging scrubs month by month (app/_v3/dashboard/Hud.tsx); a click or tap jumps to a month, and the arrow keys step through it. The tape pointer and readouts animate to each position.
- **Crossfilter:** the contract named view transitions. The build filters through the URL inside a React transition, with a pending dim, and does not use the View Transitions API.
- **Edge-code amber:** the contract kept it for real invoice numbers only. The build also uses it for Instagram frame numbers (printed like edge numbers) and the foreign-currency tag.

**Key Characteristics:**
- One shared structure; three token sets; the world switch changes material, never layout.
- The Merdeka photograph as the backdrop in every world, at a strength set by the world.
- Figures are always tabular; numbers are the protagonists.
- One authored signature interaction per world (the loupe, the tape, the crossfilter); all other motion conveys a state change.
- Private pages are dense; the public media kit is the only persuasive surface and shares the same tokens.

## Colors

Each world is a closed palette: an achromatic or near-achromatic field, plus a small set of colours whose meaning is fixed by the world.

### Primary
- **China Marker Red** (contact-china-marker): Contact Sheet's only chromatic mark. Grease-pencil circles, the handwritten questions above the three answers, the Reel series in reach charts, the pending badge, handwritten section heads on the media kit, and the negative delta.
- **HUD Stroke White** (hud-stroke-white): Flight HUD's primary and accent. Corner brackets, the altitude tape, the current-year line, the selected month, primary buttons. HUD has no decorative hue.
- **Studio Indigo** (canon-indigo, dark theme canon-dark-indigo): Studio Standard's single accent, for selection, primary action, the current-year series, month bars, and the active nav item.

### Secondary
- **Edge-Code Amber** (contact-edge-amber): Contact only. Printed codes along the film rebate: invoice numbers on panels and under the month strip, invoice codes in tables, frame numbers under Instagram prints, and the foreign-currency tag.
- **Marker Blush** (contact-marker-blush): Contact only. The emphasised word in the grease-pencil line on the hero print and the role line under his name on the media kit; a lighter pencil on a dark print.

### Tertiary (status)
- **Nominal Green** (hud-nominal-green), **Caution Yellow** (hud-caution-yellow), **Alert Red** (hud-alert-red): Flight HUD status only. Ground speed up or down, battery level for money owed, owed-invoice ageing, the re-pitch quadrant in the client map, and the feed's own LIVE and REC lights.
- **Positive / Negative** (canon-pos, canon-neg; dark theme canon-dark-pos, canon-dark-neg): Studio Standard deltas, paid tags, and old owed invoices.

### Neutral
- **Film Black** (contact-ground), **Film Base** (contact-film), **Film Base Lifted** (contact-film-2): the Contact ground, panel strips, and pressed and hover surfaces.
- **Print White** (contact-print-white): both the Contact ink and the print frame colour. Frames, mats, the month-frame border, bars.
- **Darkroom Greys** (contact-ink-2, contact-ink-3) and the hairlines (contact-line, contact-line-2): secondary text, metadata and dividers.
- **Feed Black** (hud-ground) and the **HUD scrims** (hud-scrim, hud-scrim-2): panels are translucent scrims over the feed, not fills.
- **HUD opacity steps** (hud-ink-2 at 72%, hud-edge at 62%, hud-ink-3 at 50%, hud-line-2 at 40%, hud-line at 22%): the HUD's whole hierarchy is one white at different strengths.
- **Studio neutrals** (canon-ground, canon-surface, canon-surface-2, canon-ink, canon-ink-2, canon-ink-3, canon-line, canon-line-2) and their dark-theme pairs: the zinc scale. Studio Standard is light by default and follows the theme toggle (and `prefers-color-scheme` when the theme is unset).

### Named Rules
**The Film Black Rule.** Contact Sheet's ground is neutral film black (#0D0D0D), and every scrim and gradient over it is built from the same rgb(13, 13, 13). It carries no blue cast; the only warmth is the print white.

**The Status-Only Rule.** In Flight HUD, yellow, green and red mean status and nothing else: pace, battery, ageing, attention and the feed's live light. Everything that is not a status is HUD white at an opacity step.

**The One Indigo Rule.** Studio Standard has one accent. Indigo marks selection, primary action and this year's data; there is no second decorative hue.

**The China Marker Rule.** In Contact Sheet, red is a pencil mark someone made on purpose: a circle round a keeper, a question, the Reel series. It is never a fill, a panel or a background.

**The Mapped Vocabulary Rule.** Classic v2 variable names are re-pointed at the active world inside `.v3`: `--bg` to the ground; `--card`, `--surface` to the film; `--surface2`, `--paper`, `--paper-2` to the lifted film; `--text` to the ink; `--muted`, `--ink-soft` to ink-2; `--dim`, `--ink-faint` to ink-3; `--border` to the line; `--clay`, `--clay-deep`, `--amber` to the accent; `--clay-tint`, `--clay-tint-2` to the soft mark. A reused v2 component takes the world's colours without being rewritten.

## Typography

**Contact Sheet:** Barlow Condensed (display), Barlow (UI and figures), Share Tech Mono (edge code), Caveat Brush (grease-pencil notes and the monumental figures).
**Flight HUD:** Chakra Petch for everything, display to edge code.
**Studio Standard:** Geist (UI and display), Geist Mono (figures and codes).

**Character:** Each world's type comes from its objects: the condensed industrial grotesk of film boxes and darkroom labels with a waxy china-marker hand; one technical face for every readout; the category's own face, played straight. Every face is loaded only by the v3 shell, so v1 and v2 never download them.

### Hierarchy
- **Hero figure** (Contact: Caveat Brush 400, clamp(4.5rem, 10.5vw, 10.5rem), 0.86; HUD: Chakra Petch 700, clamp(2.6rem, 5.4vw, 4.4rem), 1): year-to-date income, written across the print in pencil or read off the centre readout. The currency sits at 0.4em, raised.
- **Page title** (display face 700, 1.75rem, 1.1, -0.01em): Contact sets it at 2rem uppercase with +0.02em tracking; HUD sets it at 1.375rem, 600, uppercase, +0.08em.
- **Panel title** (display face 700, 1.125rem, 1.2): Contact uppercase +0.03em; HUD shrinks it to a 0.8125rem, 600, +0.12em uppercase instrument label in ink-2; Standard sets it at 0.9375rem, 600.
- **Body** (UI face 400, 0.9375rem, 1.5): ledes cap at 68ch, story summaries at 72ch, media-kit blurbs at 56ch.
- **Label** (0.75–0.8125rem): nav group titles, KPI labels, table heads (0.75rem, 600, ink-3). HUD readout and gauge labels run 10.5–11px uppercase at +0.14em to +0.18em.
- **Edge code** (Contact: Share Tech Mono 10.5–11.5px, +0.08em, edge amber): invoice numbers on the rebate, one line, truncated with an ellipsis.
- **Media-kit headline** (display face 700, clamp(2.6rem, 6vw, 5rem), 0.98, -0.02em): uppercase in Contact and HUD (HUD at 600).

The shared type scale is 0.75, 0.8125, 0.9375, 1.125, 1.375 and 1.75rem, with 0.9375rem as the body size.

### Named Rules
**The Tabular Rule.** Every figure is set in the world's numeric face with tabular numerals, so columns align and readouts tick without jitter.

**The Handwriting Rule.** Caveat Brush is Contact Sheet's pencil: circled answers, the questions above them, the hero income, section heads on the media kit, the follower count. The other worlds map the note role to their UI face and never handwrite.

## Layout

The app is a 232px sticky left rail beside a fluid main column (max 1320px, padding 32px top, 48px sides, 72px bottom). Panels sit on a 12-column grid with a 24px gap, spanning 12, 8, 7, 6, 5 or 4 columns; below 1100px every span becomes full width. Below 960px the rail is hidden and a sticky, horizontally scrolling bar of pill links takes its place, main padding drops to 16px, panel padding to 16px, and the grid gap to 16px.

Every private page opens with a head (title and lede on the left, actions on the right, wrapping) and then the filter bar: date range, client and work type in two deliberate rows (range and client, then kind of work). On a phone the bar becomes one horizontally scrolling row. A pending filter dims the bar to 60% until the new data lands.

The month strip is twelve equal frames. In Contact they are 3:4 prints at one shared size; on a phone the strip runs four to a row so a circle has room to mark something. In HUD and Standard the months become bars (150px and 170px tall) rising from a baseline; on a phone the HUD strip scrolls sideways at 48px per month.

The first viewport differs per world while the grid below stays the same: Contact lights the Merdeka print full width at 2.7:1 (4:3 on a phone) with three circled answers beneath; HUD sets a 120px altitude tape, a centre readout under a reticle and a 200px gauge column (tape beside gauges on a phone); Standard sets four KPIs (two per row below 900px).

The spacing scale is 4, 8, 12, 16, 24, 32, 48 and 72px. Panels pad 24px, rows 12px, lists separate with hairlines rather than gaps.

## Elevation & Depth

Depth belongs to the world, not the component. Contact Sheet lifts prints off the light table with long, dark drop shadows and flattens everything else. Flight HUD has no shadows at all: depth is translucent scrims and backdrop blur over the live feed. Studio Standard uses one quiet two-layer card shadow. The rail, mobile bar and filter bar blur what passes under them (14px and 10px) in every world.

### Shadow Vocabulary
- **Print lift** (`box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(0, 0, 0, 0.6)`): Contact's hero print on the table.
- **Loupe lift** (`box-shadow: inset 0 0 0 3px var(--frame), 0 22px 40px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(0, 0, 0, 0.8)`): a Contact month frame under the loupe.
- **Studio card** (`box-shadow: 0 1px 2px rgba(10, 10, 11, 0.04), 0 4px 16px -8px rgba(10, 10, 11, 0.08)`): every Standard panel.
- **Tooltip** (`box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5)`): the chart tooltip in every world.
- **Post hover** (`box-shadow: 0 18px 30px -16px rgba(0, 0, 0, 0.8)`): an Instagram frame lifted 3px on hover.

### Named Rules
**The Scrim Not Fill Rule.** A HUD panel is a 55% feed-black scrim with a 6px blur; the photograph must read through it.

## Shapes

Corners are a world token: Flight HUD is square (0px), Contact Sheet is barely softened (2px, the cut edge of a print), Studio Standard is rounded (10px). In Contact and Standard, containers that hold controls (the filter bar, Settings choice cards) take the world radius plus 4px (6px and 14px). Pills (99px) are Standard's tag, delta and credential shape, and the shared shape of the nav badge and mobile nav; Contact and HUD square their tags and credential off.

Each world carries its own recurring silhouette:
- **Contact:** panels are strips of film with sprocket rebates, 7px bands of 9px holes on a 17px pitch, 6px in from the top and bottom edges, and the rebate carries the edge code. Prints wear thick print-white mats (10px on the hero, 12px on the media kit, 6px on Instagram frames, 3px inset on month frames).
- **HUD:** panels are instrument windows marked only by two 18px corner brackets (2px strokes, top-left and bottom-right), a 1px centre reticle, and tick marks on the tape.
- **Standard:** a 1px hairline card; month bars have 4px top corners.

## Components

### Buttons
- **Shape:** the world radius (0, 2 or 10px); 6px by 11px padding at 0.8125rem, 500.
- **Default:** transparent with a line-2 hairline and ink text; hover washes 8% ink.
- **Primary:** an ink fill with ground text in Contact and HUD; indigo with white text in Standard. Hover mixes 14% ground into the ink.
- **Media-kit CTAs:** the same buttons at 12px by 20px, 0.9375rem.
- **Disabled:** 45% opacity, not-allowed cursor.
- **Focus:** every focusable element in v3 gets a 2px accent outline, offset 2px, at the world radius.

### Chips and segmented controls
- **Segmented:** a 5%-ink tray. The pressed segment differs per world: a 1.5px print-white inset frame (Contact), a 2px white underline (HUD), a white raised tab with a hairline ring (Standard).
- **Chips:** hairline-bordered; selected takes the mark border over the soft mark fill.

### Cards / Containers (panels)
- **Contact:** film-base fill, sprocket rebates, 38px vertical padding to clear them, uppercase titles, edge code at the top right.
- **HUD:** scrim, blur, corner brackets, instrument-label title.
- **Standard:** surface fill, 1px line, 10px radius, studio card shadow.

### Inputs / Fields
- **Style:** selects, date inputs and search share a transparent fill, a 1px line and the world radius. Date inputs use the numeric face, a 150px minimum width, and `accent-color` set to the accent; the calendar icon is inverted in the dark worlds.
- **Focus:** search raises its border to line-2 and its icon to ink; the global focus ring covers the rest.

### Navigation
- **Rail:** a brand mark (a 30px square framed in 1.5px print white; inked solid in Standard), grouped links at 0.8125rem, 500, ink-2 with 17px stroked SVG icons. Hover and current raise to ink on a 7% and 10% ink wash. The current item is a 1.5px print-white inset frame in Contact, a 1px line-2 inset in HUD, and indigo text on soft indigo in Standard. A pending count sits in a mark-coloured pill.
- **Mobile:** a sticky horizontal pill bar; the current pill is solid ink on ground.

### Month strip and the grease-pencil circle (signature)
Twelve frames, one per month; the value is exposure (Contact), bar height (HUD, Standard). In Contact, print density is `0.05 + d × 0.86` of print white, and labels flip from print white to film black once a frame is lit (density above 0.42) so every month clears contrast. The best month is the keeper and wears a red grease-pencil circle: a hand-drawn loop that overshoots its start, stroked at 3.2px (4px on Instagram frames), drawn on with a 600-unit dash offset over 900ms after a 200ms delay.

**The Explicit Circle Rule.** The circle is an absolutely positioned SVG, a replaced element: given both `top` and `bottom` it ignores `bottom` and takes its height from the viewBox. So every circle is sized explicitly, with left, top, width and height, either as insets from `--cx` and `--cy` (width 100% + 2·cx) around a figure, or as percentage boxes (80% × 48% on a month frame, 76% × 50% on an Instagram frame) when it marks an image.

### Signature interactions
- **The loupe (Contact):** hovering or focusing a month frame scales it 1.18, lifts it 6px with the loupe lift, and draws its circle on in 520ms.
- **The tape (HUD):** choosing a month moves the altitude pointer and ticks over 500ms and brightens that month's bar to full white; its value appears above it.
- **The crossfilter (Standard):** clicking a month bar or a work-type bar filters the whole page through the URL, with the filter bar dimmed while pending.

### Lists, owed, tables
Rows are hairline-separated with a 12px rhythm; the numeric column right-aligns. Share bars are 6px pills in Standard, 5px square print-white bars in Contact and 4px square white bars in HUD, growing from zero over 700ms. Owed invoices show a track whose length is exactly the days since issue: ink-3 when new, shading to the negative colour when old (HUD: caution yellow, then alert red). Table codes are edge amber in Contact, ink-2 in Standard.

### Brand wall (media kit)
**The Optical Weight Rule.** Brand logos are official vector marks flattened to one ink with a CSS mask: ink-2 in Contact and HUD, ink-3 in Standard, rising to ink on hover. Each mark is sized by optical weight from its cropped aspect ratio: height = 44 × aspect^−0.4, width capped at 170px. A square symbol stands 44px tall; a long wordmark is shorter and wider, so twelve brands read as one line-up.

### Media kit v2 (2 Oct 2026)
`app/_v3/pages/MediaKit2.tsx` + `app/_v3/kit2.css`, drawn in Studio Standard only (Aereon's chosen world). Composition: a full-bleed Merdeka hero (headline clamp(3rem, 8.4vw, 6rem), telemetry line of followers / 30-day reach / views along its foot); sentence-led sections whose figures are set inline in bold (statement size clamp(1.6rem, 3.3vw, 2.75rem)); a sunset close. **The reach skyline** is its one authored moment: thirty days of daily reach as towers with a fine lit-window grid, rising left to right on first view (1.1s each, 32ms stagger), the peak day wearing a spire and its figure. Audience panels (age, gender, cities, countries) are the shared `AudienceBreakdown`, also used on the Instagram tab. Every entrance is armed by `KitMotion.tsx` only when motion is allowed; the server renders the final state.

### Motion
Easing is one expo-out curve, cubic-bezier(0.16, 1, 0.3, 1), at 200ms for state changes. Longer moves are named: sections rise 8px over 520ms on entry; frames and posts lift in 260ms; bars grow in 700ms; the tape glides in 500ms; tooltips fade in 120ms; the player fades in 180ms. HUD LIVE and REC lights blink in two steps over 1.4s. Under `prefers-reduced-motion` every animation and transition collapses to 1ms, and circles render fully drawn.

## Do's and Don'ts

### Do:
- **Do** change a world only through its tokens and `[data-world]` overrides under `.v3`; keep structure, data, filters and copy shared across all three.
- **Do** keep Contact's ground at film black (#0D0D0D) and build its scrims from rgb(13, 13, 13).
- **Do** set every figure in the world's numeric face with tabular numerals.
- **Do** size every grease-pencil circle explicitly with left, top, width and height.
- **Do** read classic v2 components through the mapped variable names so they take the active world.
- **Do** flatten brand logos to the world's ink and size them by optical weight (44 × aspect^−0.4, max 170px wide).
- **Do** give each world exactly one authored signature interaction; every other motion reports a state change, and all of it collapses under reduced motion.
- **Do** keep HUD panels as translucent scrims so the feed reads through.

### Don't:
- **Don't** use caution yellow, nominal green or alert red in Flight HUD for anything but status.
- **Don't** add a second accent hue to Studio Standard; indigo is the only one.
- **Don't** use china-marker red in Contact as a fill or surface; it is a pencil stroke or pencil text.
- **Don't** give a positioned SVG circle both `top` and `bottom` and expect it to stretch.
- **Don't** use Caveat Brush outside Contact Sheet.
- **Don't** round HUD panels, frames, tags or brackets, or add drop shadows to HUD surfaces.
- **Don't** show brand logos in their own colours, or size them by hand.
- **Don't** let v3 tokens or fonts leak outside `.v3`; v1 and v2 keep the classic look in `app/globals.css`.
