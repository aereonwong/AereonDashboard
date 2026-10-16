// Landing page tracking: which events are accepted, how taps are named, and the insights maths.
import test from 'node:test'
import assert from 'node:assert/strict'

test('only well-formed /land events are tracked', async () => {
  const { isTrackedPath } = await import('../lib/site-visits.ts')
  for (const p of ['/', '/land/view/reel', '/land/view/kit-v2', '/land/scroll/75', '/land/time/1m', '/land/lang/ms', '/land/out/post-instagram'])
    assert.ok(isTrackedPath(p), p)
  for (const p of ['/land', '/land/view/other', '/land/scroll/60', '/land/time/2m', '/land/lang/eng', '/land/out/A', '/land/out/a/b', '/land/out/' + 'a'.repeat(41)])
    assert.ok(!isTrackedPath(p), p)
})

test('taps are named from data-t or from where the link goes', async () => {
  const { landingTapId, landingTapLabel, landingTapKind } = await import('../lib/landing-taps.ts')
  const o = 'https://aereonwong.com'
  assert.equal(landingTapId('/dashboard', 'enter-top', o), 'enter-top')
  assert.equal(landingTapId('/dashboard', null, o), 'enter')
  assert.equal(landingTapId('https://aereonwong.com/login', null, o), 'enter')
  assert.equal(landingTapId('/hello', null, o), 'page-hello')
  assert.equal(landingTapId('/', null, o), null)
  assert.equal(landingTapId('#work', null, o), null)
  assert.equal(landingTapId('mailto:hello@aereonwong.com?subject=x', null, o), 'mail')
  assert.equal(landingTapId('https://www.instagram.com/aereonwong/', null, o), 'social-instagram')
  assert.equal(landingTapId('https://www.instagram.com/reel/abc123/', null, o), 'post-instagram')
  assert.equal(landingTapId('https://www.tiktok.com/@aereon.wong/video/1', null, o), 'post-tiktok')
  assert.equal(landingTapId('https://youtu.be/xyz', null, o), 'social-youtube')
  assert.equal(landingTapId('https://shop.example.co/x', null, o), 'site-shop-example-co')
  assert.equal(landingTapLabel('post-instagram'), 'A post on Instagram')
  assert.equal(landingTapLabel('site-shop-example-co'), 'Site: shop.example.co')
  assert.equal(landingTapLabel('page-hello'), 'Page: /hello')
  assert.equal(landingTapKind('mail-cta'), 'email')
  assert.equal(landingTapKind('enter-top'), 'enter')
})

test('landing insights: funnel, scroll and time reached, versions, sign-in', async () => {
  const { analyseLanding } = await import('../lib/landing-insights.ts')
  const d = '2026-10-16'
  const rows = [
    { path: '/', day: d, visitor_hash: 'a', browser: 'Instagram app', country: 'MY', city: 'Kuala Lumpur', device: 'mobile' },
    { path: '/land/view/classic', day: d, visitor_hash: 'a' },
    { path: '/land/lang/en', day: d, visitor_hash: 'a' },
    { path: '/land/scroll/25', day: d, visitor_hash: 'a' },
    { path: '/land/scroll/50', day: d, visitor_hash: 'a' },
    { path: '/land/time/10s', day: d, visitor_hash: 'a' },
    { path: '/land/out/mail-cta', day: d, visitor_hash: 'a' },
    { path: '/land/out/post-instagram', day: d, visitor_hash: 'a' },
    { path: '/', day: d, visitor_hash: 'b', device: 'desktop', browser: 'Chrome' },
    { path: '/land/view/classic', day: d, visitor_hash: 'b' },
    { path: '/land/scroll/25', day: d, visitor_hash: 'b' },
    { path: '/land/out/enter-top', day: d, visitor_hash: 'b' },
    { path: '/login', day: d, visitor_hash: 'b' },
    { path: '/hello', day: d, visitor_hash: 'c' },
    { path: '/', day: '2026-10-14', visitor_hash: 'c', device: 'mobile' },
  ]
  const r = analyseLanding(rows, 7, d)
  assert.equal(r.visits, 3)
  assert.equal(r.visitors, 3)
  assert.equal(r.tapped, 2)
  assert.equal(r.emailed, 1)
  assert.equal(r.social, 1)
  assert.equal(r.entered, 1)
  assert.equal(r.signIn, 1)
  assert.deepEqual(r.scroll.map(s => s.visitors), [2, 1, 0, 0])
  assert.equal(r.time[0].visitors, 1)
  assert.deepEqual(r.versions, [{ id: 'classic', label: 'Front door', count: 2 }])
  assert.equal(r.languages[0].label, 'English')
  assert.equal(r.clicks.length, 3)
  assert.equal(r.daily.length, 7)
  assert.equal(r.daily.at(-1).visitors, 2)
  assert.equal(r.sources.find(s => s.label === 'Instagram').count, 1)
})
