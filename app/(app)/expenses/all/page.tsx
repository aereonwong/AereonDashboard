// 👉 Expenses → All expenses: add, filter, edit, attach receipts, export a month to Google Drive.
import { loadExpenses } from '../_load'
import All from '@/app/_v3/pages/expenses/All'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ read, version, exports, canDrive, sql, sqlUrl }, sp] = await Promise.all([loadExpenses(), searchParams])
  const page = <All read={read} sp={sp} exports={exports} canDrive={canDrive} sql={sql} sqlUrl={sqlUrl} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
