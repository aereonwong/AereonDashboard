import { NextResponse, type NextRequest } from 'next/server'
import { MARKDOWN_PATHS, isKnownPrivatePath, isPublicPath, markdownFor, notFoundHtml, notFoundMarkdown, wantsMarkdown } from '@/lib/agent-site'
import { SESSION_COOKIE, isValidSession, openDoor, sessionSecret } from '@/lib/session'
import { GATE_HEADER } from '@/lib/privacy-header'

// 🔒 Don't edit — this keeps your robot safe.
// The passcode gate. In Next 16 this file is called `proxy.ts` (the old name
// `middleware.ts` is deprecated and would print scary warnings for beginners).
//
// It's "a lock on the door, not bank-grade auth": if a session secret is set
// (AUTH_SECRET, or APP_PASSCODE) and the visitor has no VALID session cookie
// (signature checked in lib/session.ts — a cookie that merely exists proves
// nothing), we bounce them to /login. If neither is set, we DON'T gate anything —
// the app shows a calm setup banner instead, so a half-configured clone never
// locks you out of your own HQ.
const MD_HEADERS = {
  'Content-Type': 'text/markdown; charset=utf-8',
  Vary: 'Accept',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'public, max-age=0, must-revalidate',
}

// Unknown paths get a REAL 404 (Markdown for agents that ask for it, small HTML otherwise).
// Without this the gate bounced every unknown path to /login, which answers 200 — so a
// scanner or agent concluded that every URL on the site exists.
function notFound(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (wantsMarkdown(req.headers.get('accept'))) {
    return new Response(notFoundMarkdown(path), { status: 404, headers: MD_HEADERS })
  }
  return new Response(notFoundHtml(), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', Vary: 'Accept' },
  })
}

// Signed-in app requests go through marked, so lib/privacy.ts knows this is a page that
// must not receive real money figures while "Hide amounts" is on. Set here (never trusted
// from the browser: this overwrites whatever came in); public pages, the bot and the crons
// never carry it and keep reading real figures.
function gated(req: NextRequest) {
  const headers = new Headers(req.headers)
  headers.set(GATE_HEADER, 'gate')
  return NextResponse.next({ request: { headers } })
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Public pages answer Accept: text/markdown with a Markdown twin; HTML stays HTML.
  if (MARKDOWN_PATHS.includes(path)) {
    const md = wantsMarkdown(req.headers.get('accept')) ? markdownFor(path) : null
    if (md) return new Response(md, { status: 200, headers: MD_HEADERS })
    return NextResponse.next()   // (Next sets its own Vary on HTML pages; the pages are not CDN-cached)
  }
  if (isPublicPath(path)) return NextResponse.next()
  if (!isKnownPrivatePath(path)) return notFound(req)    // nothing lives here → honest 404

  if (openDoor()) return gated(req)        // no lock installed (not on production) → open door
  const secret = sessionSecret()

  const session = req.cookies.get(SESSION_COOKIE)?.value
  if (isValidSession(session, secret)) return gated(req)   // signed by us → allow

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

// The proxy now sees every path except static assets, and decides in code (lib/agent-site.ts:
// isPublicPath / isKnownPrivatePath — checked by tests/agent-site.test.mjs). These must stay
// reachable without the cookie:
//   • /about, /contact, /privacy, /robots.txt, /sitemap.xml, /llms.txt — public, for people and agents
//   • /                       — the public landing page (no private data on it)
//   • /login, /api/login, /api/auth/google/*, /api/logout — you can't log in through a locked
//     login page (Google sign-in start + callback). Only that subfolder is public; any
//     other route under /api/auth stays behind the gate.
//   • /api/telegram           — Telegram's webhook (has its own secret-header guard)
//   • /api/cron-daily         — the daily cron (has its own fail-closed Bearer guard)
//   • /api/cron-news          — the daily news digest cron (same fail-closed Bearer guard)
//   • /api/cron-instagram     — the daily Instagram refresh (same fail-closed Bearer guard)
//   • /manifest.webmanifest   — the REAL PWA manifest (app/manifest.ts serves HERE);
//     /manifest.json          — belt-and-braces extra so install never silently breaks
//   • /icons/*, /favicon.ico, /_next/* — static assets the install/render needs
// A single missed exclusion here = a locked webhook on class day, so this list is tested.
// Each name is anchored (`(?:/|$)`) so `/login-admin` or `/imgs-private` stay private.
export const config = {
  matcher: ['/((?!(?:_next|favicon\\.ico|icons|img)(?:/|$)).*)'],
}
