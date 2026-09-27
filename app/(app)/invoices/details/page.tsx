// 👉 Invoice Details — the operational table beside Invoice Summary. The server
// reads the records once; the table, filters and figures then work in the
// browser. Canva and Google Drive are only called from the row buttons.
import { getRecords, demoMode } from '@/lib/records'
import { toDetailRows, formOptions } from '@/lib/invoice-details'
import { composioReady } from '@/lib/composio-exec'
import { readVersion } from '@/lib/v3/version'
import InvoiceDetails from './InvoiceDetails'

export const dynamic = 'force-dynamic'

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function InvoiceDetailsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [rows, demo, { version }, sp] = await Promise.all([getRecords(), demoMode(), readVersion(), searchParams])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <InvoiceDetails
      rows={toDetailRows(rows, today)}
      options={formOptions(rows, today)}
      initial={{
        year: one(sp.year),
        month: one(sp.month),
        client: one(sp.client),
        payment: one(sp.payment),
        drive: one(sp.drive),
        q: one(sp.q),
      }}
      demo={demo}
      ready={composioReady()}
      v3={version === 'v3'}
    />
  )
}
