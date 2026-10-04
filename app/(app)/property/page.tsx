// 👉 Property — Aereon's home loans: outstanding balance,
// the rate the bank charges, the interest paid and what the flexi account saved.
// Replaces the "Interest Rate" Numbers sheet. Data: supabase/property.sql, lib/property.ts.
import { readFileSync } from 'fs'
import { join } from 'path'
import { readProperty } from '@/lib/property'
import { readVersion } from '@/lib/v3/version'
import V3Property from '@/app/_v3/pages/Property'

export const dynamic = 'force-dynamic'

const rm = (n: number | null | undefined) =>
  n == null ? '—' : `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function PropertyPage() {
  const [read, { version }] = await Promise.all([readProperty(), readVersion()])
  const file = (name: string) => {
    try {
      return readFileSync(join(process.cwd(), 'supabase', name), 'utf8')
    } catch {
      return `-- supabase/${name} could not be read`
    }
  }
  const sql = file('property.sql')
  const ref = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  const sqlUrl = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null

  if (version === 'v3') return <V3Property read={read} sql={sql} sqlUrl={sqlUrl} tenancySql={file('tenancy.sql')} />

  // v1 and v2: the headline figures in the classic look.
  return (
    <>
      <h1 className="ph">Property 🏠</h1>
      <p className="cap">Home loans. Switch to v3 in Settings to record a month and see the full history.</p>
      {!read.ready ? (
        <p className="metahint">Not set up yet — open this page in v3 for the one setup step.</p>
      ) : (
        <div className="chart-card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Loan</th>
                <th>Outstanding</th>
                <th>Rate</th>
                <th>As of</th>
              </tr>
            </thead>
            <tbody>
              {read.loans.map(({ loan, months }) => {
                const last = [...months].reverse().find(m => m.outstanding_balance != null)
                return (
                  <tr key={loan.id}>
                    <td data-label="Loan">{loan.name}</td>
                    <td data-label="Outstanding">{rm(last?.outstanding_balance)}</td>
                    <td data-label="Rate">{last?.rate != null ? `${last.rate.toFixed(2)}%` : '—'}</td>
                    <td data-label="As of">{last?.month.slice(0, 7) ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
