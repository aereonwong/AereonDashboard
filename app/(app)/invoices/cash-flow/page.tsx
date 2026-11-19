// 👉 Invoices → Cash flow: the company bank account (from the accountant's statements) beside what was invoiced.
// Built for v3 only; the classic layouts get the same page inside a v3 frame. Rules: app/(app)/invoices/cash-flow/CLAUDE.md
import { readFileSync } from 'fs'
import { join } from 'path'
import { readCashFlow } from '@/lib/bank'
import { canEdit } from '@/lib/auth'
import { moneyLocked } from '@/lib/privacy'
import { readVersion } from '@/lib/v3/version'
import { parseFilters, RANGES } from '@/lib/v3/filters'
import { OUT_KINDS } from '@/lib/bank-math'
import CashFlow from '@/app/_v3/pages/CashFlow'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The same date filter as Invoice Summary (lib/v3/filters.ts), carried in the URL; opens on this year.
  const sp = await searchParams
  const filters = parseFilters(sp, undefined, 'ytd')
  const out = typeof sp.out === 'string' && sp.out in OUT_KINDS ? sp.out : null // a money-out kind picked on the page
  const [view, { version }, edit, locked] = await Promise.all([readCashFlow({ from: filters.from, to: filters.to }), readVersion(), canEdit(), moneyLocked()])
  const label =
    filters.range === 'ytd' || filters.range === 'last-year' ? filters.to.slice(0, 4)
    : filters.range === 'custom' ? 'this period'
    : (RANGES.find(r => r.id === filters.range)?.label ?? '').toLowerCase()
  let sql = '-- supabase/bank.sql could not be read'
  try {
    sql = readFileSync(join(process.cwd(), 'supabase', 'bank.sql'), 'utf8')
  } catch {}
  const ref = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  const page = <CashFlow view={view} sql={sql} sqlUrl={ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null} canEdit={edit && !locked} lockNote={edit && locked ? locked : null} filters={filters} label={label} outKind={out} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
