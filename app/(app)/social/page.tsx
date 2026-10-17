// 👉 Social — every connected platform on one page. The figures are computed once a day and stored
// (social_snapshots, lib/social-totals.ts); this page only reads the stored picture for its window.
// Built for v3 only; the classic layouts get it inside a v3 frame.
import { readSocial } from '@/lib/social-totals'
import { readVersion } from '@/lib/v3/version'
import V3Social from '@/app/_v3/pages/Social'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Social({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, { version }] = await Promise.all([searchParams, readVersion()])
  const d = Array.isArray(sp.days) ? sp.days[0] : sp.days
  const days = d === '90' || d === '365' ? Number(d) : 30
  const s = await readSocial(days)
  const page = <V3Social s={s} sp={sp} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
