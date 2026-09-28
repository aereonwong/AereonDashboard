# Invoice audit · 21 Sep 2026

Every design in the Canva **Invoices** folder has now been read and imported — 2021 through 2026.
Quotations were skipped by instruction. This is what the documents themselves say, and where they
disagree with each other.

## What is in the database now

| Year | Invoices | Ringgit | Foreign |
|---|---:|---:|---|
| 2021 | 6 | RM 18,900.00 | |
| 2022 | 21 | RM 61,298.00 | USD 2,800 |
| 2023 | 45 | RM 168,892.25 | USD 3,397.80 · SGD 2,723.40 · EUR 230 |
| 2024 | 27 | RM 67,700.70 | SGD 3,155 · USD 555 |
| 2025 | 41 | RM 113,432.05 | USD 1,977.50 · SGD 1,500 |
| 2026 | 45 | RM 149,734.47 | USD 1,400 · RMB 4,000 |
| **Total** | **185** | **RM 579,957.47** | USD 10,130.30 · SGD 7,378.40 · RMB 4,000 · EUR 230 |

131 clients. All rows are status `issued` — documented, payment not tracked.

Note: 2021 and 2022 are almost certainly incomplete in Canva itself. 2021 starts at invoice #005
and only six documents survive; 2022 has visible gaps (see below).

## Not imported, on purpose

| Document | Why |
|---|---|
| `SYCP-202412-004 - Resorts World Awana Shooting` | An unedited copy of the WOLO invoice — same number `SYCP-202412-003`, same client, same RM 3,500. Importing it would have invented RM 3,500 of income. |
| `20220422 - Oppo X Legoland Quotation` | A quotation, filed in the Invoices folder. |
| `20230201 - SYCP-DO-23-06 Gamuda SplashMania` | A delivery order, not an invoice. |
| `20220221 CANCELLED - XG Coating` (2022-05, RM 5,000) | Marked cancelled. |
| `20210609 - CANCELLED Tajikistan KL Tower` (#011, RM 5,000) | Marked cancelled. |
| `20211105 - CANCELLED Fairfax` (2021-17, RM 1,000) | Marked cancelled. |

## The inconsistencies

### 1. Six numbering schemes in five years
- 2021: `005`, `011`, `012` — a plain running number, no year
- 2021–22: `2021-15`, `2022-02` — year plus sequence
- Late 2022: `SYCP-2022-34` … running **at the same time** as `2022-19`, `2022-21`
- 2023: `SYCP-2023-02` … alongside a parallel `2023-14` … `2023-21` series used only for the
  PersonEdge / Lazada jobs
- Jan 2024: `202401-01`; from Feb 2024 onward: `SYCP-202402-001` — the current scheme
- Two odd ones out: `AW-2024-02-01`, `AW-2026-01-01` (both foreign, both paid by PayPal)

Gaps: no `2023-01`, `-03`, `-14`, `-16`; 2022 jumps `2022-13` → `2022-16`; `SYCP-2022-37`/`-38`
never appear; there is no `SYCP-202503` series at all (no March 2025 invoice).

### 2. Six duplicate invoice numbers
| Number | Used on |
|---|---|
| `2023-19` | 10 Sep 2023, 19 Oct 2023, 19 Oct 2023 — **three times** |
| `2021-16` | 3 Nov 2021, 29 Dec 2021 |
| `2022-02` | 9 Jan 2022, 18 Feb 2022 |
| `SYCP-2023-34` | 15 Nov 2023, 17 Nov 2023 |
| `2023-21` | 16 Nov 2023, 21 Dec 2023 |
| `SYCP-202604-006` | 3 and 10 Apr 2026 |

Two more (`SYCP-202608-001`, `SYCP-202608-002`) were fixed at source in Canva on 21 Sep 2026 and
re-imported — see "Corrections applied" below. The six above are still live in the documents.

### 3. The file name disagrees with the document
- `2023-20 - Lazada September` prints **2023-19** inside
- `SYCP-23-27` in titles vs `SYCP-2023-27` inside — the short form is used in about 30 titles
- `20230705 - SYCP-23-23` is dated **07/07/23** inside
- `20210609 - CANCELLED Tajikistan` is dated **9 July 2021** inside
- `AW-2024-02-01 - Varlens` is dated **01/02/25** — it is a 2025 invoice
- Two titles start with a space (`" SYCP-202508-001"`, `" 20220923 - Lazada 9.90"`)

### 4. Two bank accounts
The personal account (**WONG SENG YUE**, 001-00-89274-7) is on every 2021–2022 invoice and stays on
the PersonEdge / Lazada series right through December 2023. The company account (**SY CREATIVE
PRODUCTION SDN. BHD.**, 395-00-15702-1) is on everything else. In October 2023 both were in use in
the same month. Worth a word with the accountant.

### 5. Personal data printed on invoices
The 2021 invoices print an IC number (`870427-14-5073`); one 2022 invoice prints a home address in
Cheras. Neither belongs on a document sent to a client.

### 6. Six currencies, no exchange rate recorded
MYR, USD, SGD, EUR, RMB — plus a bare `$` that means **ringgit** on the 2021 invoices and **US
dollars** on the September 2023 one. The prefix also changed from `RM` to `MYR` during 2024. No
invoice records the rate used, so foreign income cannot be converted for reporting.

### 7. Discounts live inside the price cell
About twenty invoices write `RM 3,500.00 (DISCOUNT RM500)` in the price column and then put the net
figure in the amount column. One (Peakzone, Feb 2025) does it properly with a negative line. There
is no way to total how much was discounted without reading every document.

### 8. Reimbursements mixed in with fees
HONOR Borneo Tour bills RM 5,000 of fee plus nine separate travel lines; Trip.com Singapore bills
USD 1,600 plus USD 1,147.80 of claims; Visit Singapore adds a SGD 155 bike tour; Klook adds a
RM 1,500 travel allowance. These inflate revenue — they are money passing through, not earnings.

### 9. No standard payment terms
Seen across the folder: 50/50, 30% deposit, 25/75, 40/30/30, 20% deposit, net 30 days, "before
release", "within 5 working days", "within 10 working days", and several invoices with no terms at
all. The Pavilion KL invoice says *"30% Deposit of RM30,000"* on a **RM 9,000** invoice.

### 10. Client identity is loose
- Five invoices are billed to a person, not a company (Bill Gallagher, Chew Le Chen, Lindsey Yap,
  Rick Stickney, Jessica Jenna)
- The same client appeared under two spellings four times — Wavemaker, Trip.com, DM Dasher and
  Serious Media. Those have now been merged, but it was splitting the client totals in half.
- Company registration numbers appear on maybe half the invoices; a named contact on about half
- No SST / tax identification number on any invoice

## What a standard template should fix

1. **One number series, forever**: `SYCP-YYYYMM-NNN`, never reused, never reset, issued in order.
   No parallel series for any client.
2. **File name = invoice number**, nothing else in front of it.
3. Separate fields for **subtotal, discount, reimbursements, total** — discounts as their own
   negative line, never inside a price.
4. **Currency and, for foreign invoices, the rate and its date.**
5. Fixed blocks for **client legal name, registration number, contact person and email**.
6. One **payment terms** dropdown with three or four agreed options, plus a due date.
7. The **company bank account only**, and the company registration number as the only ID printed.
8. A **status** field: Draft / Issued / Cancelled — so cancelled work is never confused with income.
9. Quotations, delivery orders and credit notes get **their own folders and prefixes**
   (`SYCP-Q-`, `SYCP-DO-`, `SYCP-CN-`).


## Corrections applied · 21 Sep 2026

Aereon corrected four invoices in Canva; they were re-read and the database updated to match.

| Was | Now | What changed |
|---|---|---|
| `SYCP-202608-001`, 8 Aug 2026 | `SYCP-202609-001`, 8 Sep 2026 | Wrong month in the number and the date |
| `SYCP-202608-002`, 17 Aug 2026 | `SYCP-202609-002`, 17 Sep 2026 | Wrong month in the number and the date |
| `SYCP-202608-002`, 17 Aug 2026 (StarGather) | `SYCP-202609-003`, 17 Sep 2026 | Wrong month; also clears a three-way number clash |
| Client "SGO Communications" | **G.O. Communications** | Misspelt company name on the three Marvel Wolverine invoices |

Effects: RM 5,000 moved from August 2026 into September 2026 (September is no longer an empty
month); duplicate invoice numbers fell from eight to six; and G.O. Communications — RM 14,500 across
three jobs — now appears under its real name, which matters because it is a top-five client of the
last twelve months.

Totals are unchanged: 185 invoices, RM 579,957.47, 131 clients.

## Job date (`meta.job_date`), added 28 Sep 2026

The date the job actually happened, beside the invoice date. When a job runs
over several days (rehearsal + show, a trip), `job_date` is the **final** day,
since that's usually the finale. Stored as YYYY-MM-DD.

- New invoices from the bot or the Create Invoice form write it automatically
  (the last of `event_dates`, else `event_date`).
- 2026 invoices were backfilled: 11 bot-raised ones from their stored event
  dates, 17 Canva imports read by hand from the design text. The other 28 2026
  Canva invoices state no usable day ("Dec 2025", "final week of August", or
  nothing at all) and were left blank on purpose, not guessed. SYCP-202604-003
  (Sabah MATTA) uses its stated posting date; SYCP-202601-013 (Merdeka 118
  licence) was left blank because its only date is when the licence was signed.
- Invoices from 2021 to 2025 have not been backfilled yet.
