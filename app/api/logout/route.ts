import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

// Signs this browser out. POST only, so a stray link or image can't do it.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303)
  res.cookies.delete({ name: SESSION_COOKIE, path: '/' })
  return res
}
