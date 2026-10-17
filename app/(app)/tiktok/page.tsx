// 👉 TikTok — @aereon.wong, read from the stored history (lib/tiktok.ts).
// Built for v3 only; the classic layouts get the same page inside a v3 frame.
import { readTiktok } from '@/lib/tiktok'
import { readVersion } from '@/lib/v3/version'
import V3Tiktok from '@/app/_v3/pages/Tiktok'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Tiktok({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [tt, sp, { version }] = await Promise.all([readTiktok(), searchParams, readVersion()])
  const page = <V3Tiktok tt={tt} sp={sp} />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
