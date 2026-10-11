# Showcase — work across the board

Moved from the root CLAUDE.md (12 Oct 2026) to keep every session's context small.

## Showcase — work across the board (added 5 Oct 2026)

The landing page and both media kits show a spread of Aereon's work, not just the recent feed (lately
mostly KLCC). `npm run ig:archive` (Composio CLI, like `ig:refresh`) lists two years of posts, gets each
one's reach, and `lib/showcase.ts` picks one tile per kind: product review, event, car review, hotel
review, aerial (drone flying or from above; a drone show stays an event), travel in Singapore / Bali / Brunei / Malaysia / abroad — KLCC at most once.
Tiles are **blended** (strongest, weakest, next strongest…) and reach is printed only on tiles at or
above the two-year median; weaker ones show their label alone. Output: `lib/showcase.json` + covers in
`public/img/work/` (saved locally — Instagram image URLs expire). Not refreshed by the cron; re-run the
script when new work should be able to make it. Classifier rules are order-sensitive; comments say why.
