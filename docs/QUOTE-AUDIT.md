# Quotation audit · 10 Oct 2026

Every design in the Canva **Quotation** folder has been read and recorded in the dashboard: 65 from Canva
plus 3 the Telegram bot had already filed, Sep 2022 → Sep 2026. **Record only** (Aereon's call): the Canva
designs were not touched, and every quote keeps the number exactly as printed. Only quotes raised from now
on follow `SYCP-Q-YYYYMM-NNN`.

The detailed findings (which quotes, clients, amounts and pairings) live in the git-ignored
`.quote-data/QUOTE-AUDIT.md`, next to the import data. The repo is public, so client names and amounts
never go here.

Loaded with `npm run quote:import` (`-- --dry` to preview) from `.quote-data/`. Each quote is a `doc` row
with status `quotation` and `meta.source = 'canva_quote'`, so nothing here is income.

## Outcomes on `/invoices/quotes`

| Outcome | Means |
|---|---|
| Won | an invoice points at it: `meta.quotation_id`, or the `QUOTATION No.` it prints |
| No invoice | no invoice, and its validity (14 days unless stated) has run out |
| Open | still within its validity |
| Lost | Aereon marked it lost |

The link lives on the **invoice** only. The import linked 29 existing invoices. A link marked
`quotation_link: 'import-likely'` was matched with small differences and should be checked by hand.
The row's + button links more; ↺ unlinks.

## Numbering formats found, kept as printed

| Period | Format |
|---|---|
| Sep 2022 | `YYYY-NN`, no prefix |
| 2023 | `SYCP-Q-2023-NN` (the Canva titles say `SYCP-Q-23-NN`) |
| Aug–Sep 2023 | `SYCP-Q-YYYYMMDD-<client code><n>` |
| Q1 2024 | `SYCP-Q-2024-qN-NN` |
| Jun 2024 → Sep 2026 | `SYCP-Q-YYYYMM-NN` |
| from Sep 2026 | `SYCP-Q-YYYYMM-NNN`, issued by the database |

Five numbers were printed on more than one quote. They are flagged "repeat no." on the page, and
linking uses the client and date to tell them apart. Two quotes give price ranges instead of one total;
they show as "options" and are left out of every sum.
