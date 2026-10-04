import 'server-only'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readProperty } from '@/lib/property'
import { readVersion } from '@/lib/v3/version'

// Everything the Property pages share: the data, the dashboard version, and the SQL files that
// switch each part on (shown on the page until they have been run once).
export async function loadProperty() {
  const [read, { version }] = await Promise.all([readProperty(), readVersion()])
  const file = (name: string) => {
    try {
      return readFileSync(join(process.cwd(), 'supabase', name), 'utf8')
    } catch {
      return `-- supabase/${name} could not be read`
    }
  }
  const ref = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  const sqlUrl = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null
  return { read, version, sql: file('property.sql'), tenancySql: file('tenancy.sql'), submeterSql: file('submeter.sql'), sqlUrl }
}
