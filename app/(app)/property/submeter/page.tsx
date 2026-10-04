// 👉 Property → Sub-meter. v3 only; the other versions keep the one-table view at /property.
import { redirect } from 'next/navigation'
import { loadProperty } from '../_load'
import { readSubmeter } from '@/lib/submeter'
import Submeter from '@/app/_v3/pages/property/Submeter'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [{ read, version, submeterSql, sqlUrl }, sub] = await Promise.all([loadProperty(), readSubmeter()])
  if (version !== 'v3') redirect('/property')
  return <Submeter read={read} sub={sub} sqlUrl={sqlUrl} submeterSql={submeterSql} />
}
