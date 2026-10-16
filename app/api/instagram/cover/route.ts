import { signedIn } from '@/lib/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'

// 👉 A small cover image for one of YOUR posts, for the ranked list on the Instagram page.
// Instagram's public link (instagram.com/p/<code>/media/?size=m) answers a server with a
// redirect to a fresh CDN image but refuses browsers, so the server fetches the small image
// and passes it on. Nothing is stored and no Composio call is spent.
//
// Guarded three ways: behind the passcode (proxy.ts), signed in here too, and only for
// shortcodes in ig_posts — so it can never fetch someone else's post.

export const dynamic = 'force-dynamic'

// A miss is never cached, so a cover Instagram was slow to give is asked for again next time.
const miss = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

const CODE = /^[A-Za-z0-9_-]{5,40}$/
const isInstagramCdn = (url: string) => {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname)
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  if (!(await signedIn())) return miss(403)
  const code = new URL(req.url).searchParams.get('code') ?? ''
  if (!CODE.test(code) || !supabaseConfigured) return miss(404)

  const { data } = await supabase.from('ig_posts').select('media_id').eq('shortcode', code).limit(1)
  if (!data?.length) return miss(404)

  try {
    const res = await fetch(`https://www.instagram.com/p/${code}/media/?size=m`, { redirect: 'manual', signal: AbortSignal.timeout(6_000) })
    const to = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && to && isInstagramCdn(to)) {
      // The CDN link refuses browsers too, so the server fetches the (~30 KB) image and passes it on.
      // No second redirect is followed (its host would be unchecked); raster images only, under 2 MB.
      const img = await fetch(to, { redirect: 'error', signal: AbortSignal.timeout(6_000) })
      const type = (img.headers.get('content-type') ?? '').split(';')[0].trim()
      const size = Number(img.headers.get('content-length') ?? 0)
      if (img.ok && /^image\/(jpeg|png|webp|gif)$/.test(type) && size <= 2_000_000) {
        const body = await img.arrayBuffer()
        if (body.byteLength <= 2_000_000) {
          return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } })
        }
      }
    }
  } catch {
    // Instagram slow or unreachable: the page shows a plain format tile instead.
  }
  return miss(404)
}
