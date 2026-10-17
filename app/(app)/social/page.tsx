// 👉 Social — every connected platform on one page, read from the stored history
// (lib/v3/social.ts). Built for v3 only; the classic layouts get it inside a v3 frame.
import { readAudience } from '@/lib/v3/audience'
import { readFacebook } from '@/lib/facebook'
import { readTiktok } from '@/lib/tiktok'
import { readIgPosts, igSource, fbSource, ttSource, buildSocial } from '@/lib/v3/social'
import { readVersion } from '@/lib/v3/version'
import { demoMode } from '@/lib/records'
import V3Social from '@/app/_v3/pages/Social'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Social({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [audience, fb, tt, sp, { version }] = await Promise.all([readAudience(), readFacebook(), readTiktok(), searchParams, readVersion()])
  const d = Array.isArray(sp.days) ? sp.days[0] : sp.days
  const days = d === '90' || d === '365' ? Number(d) : 30
  const igPosts = await readIgPosts(audience, 365)
  // One adapter per platform (lib/v3/platforms.ts says how to add one).
  const s = buildSocial([igSource(audience, igPosts, Date.now(), await demoMode()), fbSource(fb), ttSource(tt)], days)
  const page = <V3Social s={s} sp={sp} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
