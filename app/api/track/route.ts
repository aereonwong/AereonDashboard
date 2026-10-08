import { NextRequest } from 'next/server'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { SESSION_COOKIE, isValidSession, sessionSecret } from '@/lib/session'
import { TRACKED_PATHS, isBot, parseUa, klDay, visitorHash, referrerHost, clip } from '@/lib/site-visits'

// 👉 Page-view beacon for the PUBLIC pages (app/_components/Tracker.tsx posts here). Public on
// purpose — a visitor has no session — so it only ever INSERTS one small row (and answers nothing back).
// It answers 204 whatever happens: a tracker must never break or slow a page.
//
// Not counted: the signed-in owner (valid session cookie), bots, browsers sending Do Not Track
// or Global Privacy Control, and any path that is not a public page. No IP is stored.

export const dynamic = 'force-dynamic'
const done = () => new Response(null, { status: 204 })

export async function POST(req: NextRequest) {
  try {
    const h = req.headers
    if (h.get('dnt') === '1' || h.get('sec-gpc') === '1') return done()

    const ua = h.get('user-agent') ?? ''
    if (isBot(ua)) return done()

    const secret = sessionSecret()
    if (!secret) return done()   // no real secret → the visitor hash would be guessable, so log nothing
    if (isValidSession(req.cookies.get(SESSION_COOKIE)?.value, secret)) return done()

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const path = body?.path
    if (typeof path !== 'string' || !TRACKED_PATHS.includes(path)) return done()
    if (!supabaseConfigured) return done()

    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || ''
    const day = klDay()
    let city = h.get('x-vercel-ip-city')
    try { if (city) city = decodeURIComponent(city) } catch { /* keep raw */ }

    const hash = visitorHash(secret, ip, ua, day)
    // Same visitor, same page, within 10 minutes = a reload or a scripted repeat: count once.
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { count } = await supabase.from('site_visits').select('id', { count: 'exact', head: true })
      .eq('visitor_hash', hash).eq('path', path).gte('ts', since)
    if (count) return done()

    const { error } = await supabase.from('site_visits').insert({
      path,
      referrer_host: referrerHost(body?.referrer, h.get('host') ?? ''),
      utm_source: clip(body?.utm_source), utm_medium: clip(body?.utm_medium), utm_campaign: clip(body?.utm_campaign),
      country: clip(h.get('x-vercel-ip-country'), 2),
      city: clip(city, 80),
      ...parseUa(ua),
      visitor_hash: hash,
    })
    if (error) console.warn('[track] insert failed:', error.message)
  } catch (e) {
    console.warn('[track]', e instanceof Error ? e.message : e)
  }
  return done()
}
