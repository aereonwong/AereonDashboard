// 👉 Property → Tenancy. v3 only; the other versions keep the one-table view at /property.
import { redirect } from 'next/navigation'
import { loadProperty } from '../_load'
import Tenancy from '@/app/_v3/pages/property/Tenancy'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { read, version, sql, tenancySql, sqlUrl } = await loadProperty()
  if (version !== 'v3') redirect('/property')
  return <Tenancy read={read} sqlUrl={sqlUrl} tenancySql={tenancySql} />
}
