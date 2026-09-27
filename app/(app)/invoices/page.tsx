// 👉 Invoice Summary — the money view of the work you've invoiced, built from the
// same `records` table (cash_in rows that carry meta.invoice_no, imported from Canva).
// Summary only: the invoice-by-invoice table lives on Invoice Details.
import { getRecords, rm } from '@/lib/records'
import { summarize } from '@/lib/invoices'
import { toDetailRows } from '@/lib/invoice-details'
import StatusStrip from './StatusStrip'
import Stat from '@/app/_components/Stat'
import Empty from '@/app/_components/Empty'
import InteractiveBars from '@/app/_components/InteractiveBars'
import RowBars from '@/app/_components/RowBars'
import Donut from '@/app/_components/Donut'
import Icon from '@/app/_components/Icon'

import V3Invoices from '@/app/_v3/pages/Invoices'
import { readVersion } from '@/lib/v3/version'
import { parseFilters } from '@/lib/v3/filters'

export const dynamic = 'force-dynamic'

const pct = (n: number) => `${n.toFixed(0)}%`

export default async function InvoiceSummary({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { version } = await readVersion()
  if (version === 'v3') {
    const [rows, sp] = await Promise.all([getRecords(), searchParams])
    return <V3Invoices rows={rows} filters={parseFilters(sp, undefined, 'ytd')} sp={sp} />
  }
  const rows = await getRecords()
  const s = summarize(rows)

  if (s.invoices.length === 0) {
    return (
      <>
        <h1 className="ph">Invoice Summary 🧾</h1>
        <p className="cap">Everything you've invoiced — totals, months, clients, work type.</p>
        <Empty label="invoices" />
      </>
    )
  }

  const span =
    s.months.length > 0
      ? `${s.months[0].month} → ${s.months[s.months.length - 1].month}`
      : ''

  return (
    <>
      <h1 className="ph">Invoice Summary 🧾</h1>
      <p className="cap">Everything you've invoiced — totals, months, clients, work type.</p>

      <div className="grid">
        <Stat label="Total invoiced" value={rm(s.totalRM)} icon="wallet" />
        <Stat label="Invoices" value={String(s.countRM)} icon="invoice" />
        <Stat label="Clients" value={String(s.clients.length)} icon="users" />
        <Stat label="Average invoice" value={rm(Math.round(s.averageRM))} icon="chart" />
        <Stat label="Biggest invoice" value={rm(s.biggest?.amount ?? 0)} icon="sparkle" />
        {s.bestMonth ? <Stat label={`Best month (${s.bestMonth.month})`} value={rm(s.bestMonth.total)} icon="calendar" /> : null}
      </div>

      <StatusStrip rows={toDetailRows(rows)} />

      {s.otherCurrency.length > 0 ? (
        <p className="metahint">
          {s.otherCurrency.map(c => `${c.count} invoice${c.count > 1 ? 's' : ''} in ${c.currency} (${c.currency} ${c.total.toLocaleString('en-MY')})`).join(' · ')}
          {' '}— kept out of the RM totals.
        </p>
      ) : null}

      <div className="chart-card">
        <h2><Icon name="chart" /> Invoiced by month</h2>
        <p className="sub">RM per month{span ? ` · ${span}` : ''} · hover a bar for the invoice count</p>
        <InteractiveBars
          points={s.months.map(m => ({
            label: m.label,
            sub: `${m.count} invoice${m.count === 1 ? '' : 's'}`,
            values: { amount: m.total, count: m.count },
          }))}
          series={[
            { id: 'amount', label: 'RM', unit: 'rm' as const },
            { id: 'count', label: 'Invoices', unit: 'plain' as const },
          ]}
        />
      </div>

      <div className="split">
        <div className="chart-card">
          <h2><Icon name="users" /> Top clients</h2>
          <p className="sub">
            {s.clients[0]?.name} is {pct(s.topClientShare)} of everything you invoiced
            {s.topClientShare >= 40 ? ' — that is a lot from one client' : ''}
          </p>
          <RowBars
            rows={s.clients.slice(0, 5).map(c => ({
              name: c.name,
              value: c.totalRM,
              right: `${rm(c.totalRM)} · ${c.invoices.length} job${c.invoices.length === 1 ? '' : 's'}`,
            }))}
          />
        </div>

        <div className="chart-card">
          <h2><Icon name="pie" /> Work type</h2>
          <p className="sub">Grouped from what each invoice describes · hover a slice</p>
          <Donut
            slices={s.byKind.map(k => ({ label: k.kind, value: k.total }))}
            centerLabel="invoiced by work type"
            unit="rm"
          />
        </div>
      </div>

      <div className="grid">
        <Stat label="Repeat clients" value={`${s.repeatClients} of ${s.clients.length}`} icon="users" />
        <Stat label="From repeat clients" value={pct(s.repeatRevenueShare)} icon="heart" />
        <Stat label="Top-client concentration" value={pct(s.topClientShare)} yes={s.topClientShare >= 40} icon="pie" />
      </div>

    </>
  )
}
