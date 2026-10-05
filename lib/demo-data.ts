import type { Rec } from './records'
import type { BankRate, DataIssue, Loan, LoanMonthRow } from './property-math'
import type { Cost, Tenancy } from './tenancy-math'
import type { Bill, Reading } from './submeter-math'

// 👉 DEMO DATA — the fake business behind Settings → "Use demo data".
// Nothing here touches Supabase: these rows are generated in memory, so your real
// invoices and clients are never read, changed or shown while demo mode is on.
// Names are deliberately obvious inventions.

const DAY = 86_400_000
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10)

let seq = 0
const row = (r: Partial<Rec> & { title: string; category: string }): Rec =>
  ({
    id: 900_000 + seq++,
    status: 'open',
    amount: 0,
    due_date: null,
    notes: '',
    meta: {},
    created_at: iso(30),
    ...r,
  }) as Rec

// A demo client book: [company, contact, invoices as [daysAgo, amount, project]]
const BOOK: [string, string, [number, number, string][]][] = [
  ['Lumipix Studios Sdn Bhd', 'Farah Lim', [[12, 6500, 'Rooftop drone shoot: skyline sunset series'], [68, 4200, 'Product launch aerial coverage'], [140, 3800, 'Mall atrium hero video']]],
  ['Bayu Tourism Board', 'Iskandar Rahim', [[26, 12000, 'Island campaign: 3 reels + stills'], [96, 9000, 'Highland festival coverage']]],
  ['Northwind Media Group', 'Cheryl Teoh', [[6, 5200, 'Reel campaign for beverage brand'], [47, 5200, 'Second flight: café series']]],
  ['Kirana Hotels', 'Danial Yusof', [[34, 7400, 'Resort walkthrough film + photo set']]],
  ['Volt Mobility', 'Adrian Koh', [[19, 3000, 'EV launch event photography']]],
  ['Selasih Property', 'Nurul Aziz', [[58, 8800, 'Township aerial survey + marketing cut']]],
  ['Harta Coffee Co.', 'Bryan Ng', [[81, 1800, 'Single reel: new roastery']]],
  ['Pelangi Events', 'Mei Chan', [[41, 4600, 'Gala dinner coverage, 2 shooters']]],
  ['Terra Outdoor', 'Sam Devan', [[112, 2600, 'Trail campaign reel']]],
  ['Bandar Skyline Mall', 'Joanne Foo', [[73, 5400, 'Festive drone show coverage'], [160, 5400, 'Anniversary weekend films']]],
]

export function demoRecords(): Rec[] {
  seq = 0
  const out: Rec[] = []

  // ---- invoices (cash_in, "issued" like the real import) + the client rows ----
  let n = 1
  for (const [company, contact, invoices] of BOOK) {
    const dates = invoices.map(i => day(i[0])).sort()
    for (const [daysAgo, amount, project] of invoices) {
      const no = `DEMO-${String(1000 + n++)}`
      out.push(
        row({
          title: `${no} · ${project.split(':')[0]}`,
          category: 'cash_in',
          status: 'issued',
          amount,
          notes: project,
          created_at: iso(daysAgo),
          meta: {
            customer: company,
            contact,
            invoice_no: no,
            invoice_date: day(daysAgo),
            source: 'demo',
            payment_tracked: false,
          },
        }),
      )
    }
    out.push(
      row({
        title: company,
        category: 'customer',
        status: 'active',
        amount: 0,
        notes: `Demo client · ${invoices.length} job${invoices.length > 1 ? 's' : ''}`,
        created_at: iso(invoices[0][0]),
        meta: {
          company,
          contacts: contact,
          address: 'Demo address, Kuala Lumpur',
          jobs: invoices.length,
          total_invoiced: invoices.reduce((s, i) => s + i[1], 0),
          first_job: dates[0],
          last_touch: dates[dates.length - 1],
          owes: 0,
          payment_tracked: false,
          source: 'demo',
        },
      }),
    )
  }

  // One invoice in another currency, so the multi-currency handling shows up.
  out.push(
    row({
      title: 'DEMO-1099 · Regional brand collab',
      category: 'cash_in',
      status: 'issued',
      amount: 1500,
      notes: 'Regional brand collab: 1 reel, 30-day usage',
      created_at: iso(23),
      meta: {
        customer: 'Pacific Reach Pte Ltd',
        contact: 'Grace Tan',
        invoice_no: 'DEMO-1099',
        invoice_date: day(23),
        currency: 'USD',
        source: 'demo',
        payment_tracked: false,
      },
    }),
  )

  // ---- expenses ----
  for (const [daysAgo, amount, what, cat] of [
    [3, 189, 'Drone battery set', 'Equipment'],
    [9, 420, 'Editing suite subscription', 'Software'],
    [14, 96, 'Parking + tolls, city shoot', 'Travel'],
    [22, 1250, 'Second shooter day rate', 'Crew'],
    [31, 310, 'Insurance instalment', 'Admin'],
  ] as [number, number, string, string][]) {
    out.push(
      row({
        title: what,
        category: 'cash_out',
        status: 'paid',
        amount,
        created_at: iso(daysAgo),
        meta: { category: cat, source: 'demo' },
      }),
    )
  }

  // ---- pipeline ----
  for (const [name, stage, value, next] of [
    ['Arus Bank — brand film', 'new', 15000, 'send capability deck'],
    ['Melur Retail — festive reels', 'contacted', 8000, 'follow up Tuesday'],
    ['Hikari Auto — launch coverage', 'appointment', 12000, 'recce on site'],
    ['Pantai Resorts — 2027 retainer', 'appointment', 24000, 'proposal walkthrough'],
    ['Suria Telco — drone show', 'closed', 18000, 'invoice + schedule'],
    ['Cahaya Studio — collab', 'nurture', 4000, 'check back next quarter'],
  ] as [string, string, number, string][]) {
    out.push(
      row({
        title: name,
        category: 'lead',
        status: stage,
        amount: value,
        due_date: day(-7),
        created_at: iso(20),
        meta: { potential: value, next, source: 'demo' },
      }),
    )
  }

  // ---- tasks ----
  for (const [title, dueIn, owner] of [
    ['Deliver Lumipix final cut', 1, 'me'],
    ['Send Bayu Tourism invoice reminder', 0, 'me'],
    ['Book CAAM permit for mall shoot', 4, 'me'],
    ['Back up September footage', -2, 'me'],
  ] as [string, number, string][]) {
    out.push(
      row({
        title,
        category: 'task',
        status: 'open',
        due_date: day(-dueIn),
        created_at: iso(5),
        meta: { owner, source: 'demo' },
      }),
    )
  }

  // ---- content ----
  for (const [title, status, platform, views, daysAgo] of [
    ['Reel: skyline timelapse', 'posted', 'instagram', 42000, 4],
    ['Carousel: gear I travel with', 'posted', 'instagram', 18500, 11],
    ['Reel: behind the drone show', 'scheduled', 'tiktok', 0, -3],
    ['Vlog: shooting a resort film', 'draft', 'youtube', 0, -8],
  ] as [string, string, string, number, number][]) {
    out.push(
      row({
        title,
        category: 'content',
        status,
        amount: 0,
        due_date: day(daysAgo),
        created_at: iso(Math.max(daysAgo, 0)),
        meta: { platform, format: 'reel', views, source: 'demo' },
      }),
    )
  }

  return out.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

// Property tab demo: one invented flexi loan, 30 months, generated in memory.
export function demoProperty(): {
  loans: Loan[]
  months: LoanMonthRow[]
  rates: BankRate[]
  issues: DataIssue[]
  tenancies: Tenancy[]
  costs: Cost[]
} {
  const loan: Loan = {
    id: 'demo-residence', name: 'Demo Residence', location: 'Bandar Contoh', bank: 'Demo Bank', loan_type: 'Full flexi',
    rate_basis: 'BR', spread: 0.5, cycle_day: 1, loan_amount: 450_000, tenure_months: 420, first_month: '2024-04-01', notes: null, sort: 1,
  }
  const rates: BankRate[] = [
    { bank: 'Demo Bank', effective_date: '2023-05-01', base_rate: 3.8, sbr: null, source: 'demo' },
    { bank: 'Demo Bank', effective_date: '2025-07-15', base_rate: 3.55, sbr: null, source: 'demo' },
  ]
  const months: LoanMonthRow[] = []
  let bal = 450_000
  const start = Date.UTC(2024, 3, 1)
  for (let i = 0; i < 30; i++) {
    const d = new Date(start)
    d.setUTCMonth(d.getUTCMonth() + i)
    const month = d.toISOString().slice(0, 10)
    const pending = i === 29
    const cash = Math.min(bal * 0.9, 40_000 + i * 9_000) // flexi cash building up
    const rate = (month >= '2025-08-01' ? 4.05 : 4.3) / 100
    const interest = Math.round(((bal - cash) * rate * 30) / 365 * 100) / 100
    const next = Math.round((bal - (2_250 - interest)) * 100) / 100
    months.push({
      property_id: loan.id, month, opening_balance: i === 0 ? bal : null, outstanding_balance: pending ? null : next,
      instalment: 2_250, interest_charged: null, status: pending ? 'pending' : 'normal', quality: pending ? 'unchecked' : 'statement', note: null,
    })
    if (!pending) bal = next
  }
  const tenancies: Tenancy[] = [
    { id: 1, property_id: loan.id, start_date: '2025-06-01', end_date: '2026-05-31', monthly_rent: 2_100, advance_rent: 2_100, security_deposit: 4_200, utility_deposit: 1_050, access_card_deposit: 100, deposit_refunded: null, tenant_name: 'Demo Tenant', notes: null },
    { id: 2, property_id: loan.id, start_date: '2026-06-01', end_date: '2028-05-31', monthly_rent: 2_300, advance_rent: null, security_deposit: null, utility_deposit: null, access_card_deposit: null, deposit_refunded: null, tenant_name: 'Demo Tenant', notes: 'Renewed for two years' },
  ]
  const costs: Cost[] = [
    { id: 1, property_id: loan.id, cost_date: day(20), kind: 'maintenance_fee', amount: 180, description: 'Quarterly maintenance fee', vendor: 'Demo Management', tenant_name: null, recovered_from_deposit: false },
    { id: 2, property_id: loan.id, cost_date: day(75), kind: 'repair', amount: 350, description: 'Aircond service and gas top-up', vendor: 'Demo Cooling', tenant_name: null, recovered_from_deposit: false },
  ]
  costs.push({ id: 3, property_id: loan.id, cost_date: '2026-06-01', kind: 'agent_fee', amount: 1_150, description: 'Renewal fee', vendor: 'Demo Realty', tenant_name: null, recovered_from_deposit: false })
  return { loans: [loan], months, rates, issues: [], tenancies, costs }
}

// Sub-meter demo: two units on the invented property, a few months of readings and TNB bills.
export function demoSubmeter(): { readings: Reading[]; bills: Bill[] } {
  const id = 'demo-residence'
  const rows: [string, string, number, number | null, boolean][] = [
    ['Main unit', '2026-05-12', 1000, null, true], ['Main unit', '2026-06-12', 1380, 0.52, true], ['Main unit', '2026-07-12', 1770, 0.5, false], ['Main unit', '2026-08-12', 2150, 0.5, false],
    ['Studio', '2026-05-12', 400, null, true], ['Studio', '2026-06-12', 520, 0.35, true], ['Studio', '2026-07-12', 650, 0.5, false], ['Studio', '2026-08-12', 790, 0.5, false],
  ]
  const readings = rows.map(([unit, read_on, reading, rate, legacy], i) => ({ id: i + 1, property_id: id, unit, read_on, reading, rate, legacy, note: null, tenant_name: unit === 'Studio' ? 'Demo Studio Tenant' : 'Demo Tenant', paid_on: read_on < '2026-08-01' ? read_on : null }))
  const bills: Bill[] = [
    { id: 1, property_id: id, bill_date: '2026-06-12', amount: 205, kwh: 500, kw: 4, kvarh: 150, note: null },
    { id: 2, property_id: id, bill_date: '2026-07-12', amount: 215, kwh: 520, kw: 4, kvarh: 160, note: null },
    { id: 3, property_id: id, bill_date: '2026-08-12', amount: 222, kwh: 520, kw: 5, kvarh: 170, note: null },
  ]
  return { readings, bills }
}
