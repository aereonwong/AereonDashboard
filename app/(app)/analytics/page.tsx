// 👉 /analytics has no page of its own: Site analytics is a nav group of two pages,
// /analytics/landing and /analytics/link. Old links (?page=hello) land on the right one.
import { redirect } from 'next/navigation'

export default async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const days = one(q.days)
  redirect(`/analytics/${one(q.page) === 'hello' ? 'link' : 'landing'}${days ? `?days=${encodeURIComponent(days)}` : ''}`)
}
