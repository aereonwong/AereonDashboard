// The request header proxy.ts adds to every signed-in app request; lib/privacy.ts reads it.
// Its own file because the proxy must not import lib/privacy.ts (server-only, next/headers).
export const GATE_HEADER = 'x-cfo-money'
export const REVEAL_COOKIE = 'cfo-reveal'
