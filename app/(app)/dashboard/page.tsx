// 👉 The Dashboard comes in two layouts and Settings decides which one you get:
//   · v2 (default) — the operating picture: figures, decisions, category trends
//   · v1           — the original creator view: hero card, invoices, Instagram
// Both read exactly the same rows, so switching never changes a number.
import { cookies } from 'next/headers'
import { getRecords } from '@/lib/records'
import { latestSnapshot, latestAccount, readAudienceView } from '@/lib/instagram'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import DashboardV1 from './_v1'
import DashboardV2 from './_v2'
import DashboardV3 from '@/app/_v3/dashboard/Dashboard'
import { readVersion } from '@/lib/v3/version'
import { parseFilters } from '@/lib/v3/filters'
import { readAudience } from '@/lib/v3/audience'

export const dynamic = 'force-dynamic'

// Count of proposals still waiting on a human YES — the 🙋 number. Guarded so an
// unconfigured/placeholder Supabase returns 0 instantly instead of hanging.
async function proposedCount(): Promise<number> {
  if (!supabaseConfigured) return 0
  const { count, error } = await supabase
    .from('agent_actions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'proposed')
  if (error) return 0
  return count ?? 0
}

/** Which layout to draw. Anything other than an explicit 'v1' means v2. */
async function layout(): Promise<'v1' | 'v2'> {
  try {
    const jar = await cookies()
    return jar.get('cfo-dash')?.value === 'v1' ? 'v1' : 'v2'
  } catch {
    return 'v2'
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { version, world } = await readVersion()
  if (version === 'v3') {
    const [rows, audience, sp] = await Promise.all([getRecords(), readAudience(), searchParams])
    return <DashboardV3 rows={rows} filters={parseFilters(sp)} world={world} audience={audience} />
  }

  const [rows, snap, waiting, which, account] = await Promise.all([
    getRecords(),
    latestSnapshot(),
    proposedCount(),
    layout(),
    latestAccount(),
  ])
  const ig = account ? readAudienceView(account, snap?.profile.followers_count ?? 0) : null

  return which === 'v1' ? (
    <DashboardV1 rows={rows} snap={snap} waiting={waiting} />
  ) : (
    <DashboardV2 rows={rows} snap={snap} ig={ig} />
  )
}
