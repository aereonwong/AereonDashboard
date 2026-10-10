// 👉 Quotations — every quote on file, what became of it, and a Convert button
// that opens Create Invoice filled in from it. Read from the same `records`
// table as Invoice Details; quotes are `doc` rows and never count as income.
import { getRecords, demoMode } from '@/lib/records'
import { toQuoteRows, quoteLinks } from '@/lib/quotes'
import { formOptions } from '@/lib/invoice-details'
import { composioReady } from '@/lib/composio-exec'
import { readVersion } from '@/lib/v3/version'
import Quotations, { type LinkableInvoice } from './Quotations'

export const dynamic = 'force-dynamic'

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [rows, demo, { version }, sp] = await Promise.all([getRecords(), demoMode(), readVersion(), searchParams])
  const today = new Date().toISOString().slice(0, 10)
  const linked = quoteLinks(rows)
  // Invoices a quote can be linked to by hand: the ones no quote claims yet.
  const invoices: LinkableInvoice[] = rows
    .filter(r => r.category === 'cash_in' && r.meta?.invoice_no && !linked.has(r.id))
    .map(r => ({
      id: r.id,
      no: String(r.meta.invoice_no),
      date: String(r.meta?.invoice_date || r.created_at).slice(0, 10),
      client: String(r.meta?.customer ?? ''),
      job: String(r.meta?.job ?? r.notes ?? ''),
      amount: Number(r.amount) || 0,
      currency: String(r.meta?.currency ?? 'MYR'),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Quotations
      rows={toQuoteRows(rows, today)}
      invoices={invoices}
      options={formOptions(rows, today)}
      initial={{ year: one(sp.year), status: one(sp.status), client: one(sp.client), q: one(sp.q) }}
      demo={demo}
      ready={composioReady()}
      v3={version === 'v3'}
    />
  )
}
