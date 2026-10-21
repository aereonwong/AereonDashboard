// 👉 Expenses → Overview: what the company spends, by kind and month, and which receipts are still owed.
// Built for v3 only; the classic layouts get the same page inside a v3 frame.
import { loadExpenses } from './_load'
import Overview from '@/app/_v3/pages/expenses/Overview'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { read, version, sql, sqlUrl } = await loadExpenses()
  const page = <Overview read={read} sql={sql} sqlUrl={sqlUrl} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
