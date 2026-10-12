// 👉 Facebook — the Aereon Wong Page, read from the stored history (lib/facebook.ts).
// Built for v3 only; the classic layouts get the same page inside a v3 frame.
import { readFacebook } from '@/lib/facebook'
import { readVersion } from '@/lib/v3/version'
import V3Facebook from '@/app/_v3/pages/Facebook'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Facebook({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [fb, sp, { version }] = await Promise.all([readFacebook(), searchParams, readVersion()])
  const page = <V3Facebook fb={fb} sp={sp} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
