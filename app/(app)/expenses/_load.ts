import 'server-only'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readExpenses } from '@/lib/expenses'
import { monthExports } from '@/lib/expense-drive'
import { composioReady } from '@/lib/composio-exec'
import { readVersion } from '@/lib/v3/version'

// Everything the Expenses pages share: the rows, the dashboard version, whether Drive can be reached, and the SQL
// file that switches the section on (shown on the page until it has been run once).
export async function loadExpenses() {
  const [read, { version }, exports] = await Promise.all([readExpenses(), readVersion(), monthExports().catch(() => ({}))])
  let sql: string
  try {
    sql = readFileSync(join(process.cwd(), 'supabase', 'expenses.sql'), 'utf8')
  } catch {
    sql = '-- supabase/expenses.sql could not be read'
  }
  const ref = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  const sqlUrl = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null
  return { read, version, exports, canDrive: composioReady(), sql, sqlUrl }
}
