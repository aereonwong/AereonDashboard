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

test('bot filter: only visitors who did something (or came from an app) count, from CHECKS_FROM on', async () => {
  const { analyseLanding } = await import('../lib/landing-insights.ts')
  const { analyseHello, CHECKS_FROM } = await import('../lib/hello-insights.ts')
  const { cleanHello } = await import('../lib/hello-config.ts')
  const d = '2026-10-20'
  assert.ok(d >= CHECKS_FROM)
  const rows = [
    // a person: scrolled
    { path: '/', day: d, visitor_hash: 'p', browser: 'Safari', city: 'Kuala Lumpur', country: 'MY' },
    { path: '/land/view/classic', day: d, visitor_hash: 'p', browser: 'Safari' },
    { path: '/land/scroll/25', day: d, visitor_hash: 'p', browser: 'Safari' },
    // a crawler running JS: view + language, nothing else
    { path: '/', day: d, visitor_hash: 'b', browser: 'Chrome', city: 'Council Bluffs', country: 'US' },
    { path: '/land/view/classic', day: d, visitor_hash: 'b', browser: 'Chrome' },
    { path: '/land/lang/en', day: d, visitor_hash: 'b', browser: 'Chrome' },
    // no script at all
    { path: '/', day: d, visitor_hash: 'c', browser: 'Chrome' },
    // opened inside Instagram, left at once: still a person
    { path: '/', day: d, visitor_hash: 'i', browser: 'Instagram app' },
    // before the filter began: counted as logged
    { path: '/', day: '2026-10-15', visitor_hash: 'old', browser: 'Chrome' },
  ]
  const r = analyseLanding(rows, 7, d)
  assert.equal(r.visitors, 3)   // p, i, and 'old' (before the filter began)
  assert.equal(r.visits, 3)
  assert.deepEqual(r.bots, { visitors: 2, views: 2 })
  assert.ok(!r.cities.some(c => c.label.startsWith('Council Bluffs')))

  const h = analyseHello([
    { path: '/hello', day: d, visitor_hash: 'x', browser: 'Chrome' },
    { path: '/hello/time/10s', day: d, visitor_hash: 'x', browser: 'Chrome' },
    { path: '/hello', day: d, visitor_hash: 'y', browser: 'Chrome' },
  ], cleanHello({}), 7, d)
  assert.equal(h.visitors, 1)
  assert.deepEqual(h.bots, { visitors: 1, views: 1 })
})

test('media kit: only well-formed /kit events are tracked', async () => {
  const { isTrackedPath } = await import('../lib/site-visits.ts')
  for (const p of ['/mediakit', '/kit/slide/1', '/kit/slide/9', '/kit/scroll/50', '/kit/time/3m', '/kit/lang/zh', '/kit/out/pdf', '/kit/out/work-samsung-s25-fe'])
    assert.ok(isTrackedPath(p), p)
  for (const p of ['/kit', '/kit/slide/0', '/kit/slide/10', '/kit/scroll/60', '/kit/out/Pdf', '/kit/out/a/b', '/kit/out/' + 'a'.repeat(41), '/mediakit/x'])
    assert.ok(!isTrackedPath(p), p)
})

test('media kit insights: slides reached, funnel, bots left out', async () => {
  const { analyseKit, kitTapLabel } = await import('../lib/kit-insights.ts')
  const d = '2026-10-19'
  const rows = [
    { path: '/mediakit', day: d, visitor_hash: 'a', browser: 'Chrome', country: 'SG', city: 'Singapore', device: 'desktop', utm_source: 'pitch' },
    { path: '/kit/slide/1', day: d, visitor_hash: 'a' },
    { path: '/kit/slide/2', day: d, visitor_hash: 'a' },
    { path: '/kit/slide/9', day: d, visitor_hash: 'a' },
    { path: '/kit/scroll/100', day: d, visitor_hash: 'a' },
    { path: '/kit/time/30s', day: d, visitor_hash: 'a' },
    { path: '/kit/out/work-samsung-s25-fe', day: d, visitor_hash: 'a' },
    { path: '/kit/out/pdf', day: d, visitor_hash: 'a' },
    { path: '/kit/out/mail', day: d, visitor_hash: 'a' },
    { path: '/mediakit', day: d, visitor_hash: 'b', browser: 'Instagram app', device: 'mobile' },
    { path: '/kit/slide/1', day: d, visitor_hash: 'b' },
    { path: '/kit/out/social-instagram', day: d, visitor_hash: 'b' },
    { path: '/mediakit', day: d, visitor_hash: 'bot', browser: 'Chrome' },
    { path: '/kit/slide/1', day: d, visitor_hash: 'bot' },
    { path: '/', day: d, visitor_hash: 'c' },
  ]
  const r = analyseKit(rows, 7, d)
  assert.equal(r.visits, 2)
  assert.equal(r.visitors, 2)
  assert.deepEqual(r.bots, { visitors: 1, views: 1 })
  assert.equal(r.finished, 1)
  assert.equal(r.work, 1)
  assert.equal(r.pdf, 1)
  assert.equal(r.emailed, 1)
  assert.equal(r.social, 1)
  assert.equal(r.slides[0].visitors, 2)
  assert.equal(r.slides[0].label, '1. Cover')
  assert.equal(r.slides.length, 9)
  assert.equal(r.time.find(t => t.id === '30s').visitors, 1)
  assert.equal(r.daily.at(-1).visitors, 2)
  assert.equal(kitTapLabel('work-samsung-s25-fe'), 'Work: Samsung s25 fe')
  assert.equal(kitTapLabel('pdf'), 'Downloaded the PDF')
  assert.equal(kitTapLabel('social-instagram'), 'Profile: Instagram')
})

test('media kit share links: random codes, clean rows, per-link results under the brand name', async () => {
  const { newCode, cleanKitLinks, CODE, kitUrl } = await import('../lib/kit-links-config.ts')
  const { webcrypto } = await import('node:crypto')
  const rand = n => webcrypto.getRandomValues(new Uint8Array(n))
  const taken = new Set()
  for (let i = 0; i < 200; i++) { const c = newCode(taken, rand); assert.match(c, CODE); assert.ok(!taken.has(c)); taken.add(c) }
  assert.ok(!CODE.test('abc0e1') && !CODE.test('ABCDEF') && !CODE.test('abcde'))
  assert.equal(kitUrl('k7q2xm'), 'https://aereonwong.com/mediakit?r=k7q2xm')
  const c = cleanKitLinks({ links: [
    { code: 'k7q2xm', brand: '  Samsung   MY ', note: 'x', created: '2026-10-19T01:00' },
    { code: 'k7q2xm', brand: 'dupe', created: '2026-10-20' },
    { code: 'BAD', brand: 'nope' }, { code: 'abcdef', brand: '' }, null,
    { code: 'mnpqrs', brand: 'Honor', created: '2026-10-20' },
  ] })
  assert.deepEqual(c.links.map(l => [l.code, l.brand, l.created]), [['mnpqrs', 'Honor', '2026-10-20'], ['k7q2xm', 'Samsung MY', '2026-10-19']])
  assert.deepEqual(cleanKitLinks(null), { links: [] })

  const { analyseKit } = await import('../lib/kit-insights.ts')
  const d = '2026-10-19'
  const rows = [
    { path: '/mediakit', day: d, visitor_hash: 'a', browser: 'Chrome', utm_source: 'k7q2xm' },
    { path: '/kit/scroll/100', day: d, visitor_hash: 'a' },
    { path: '/kit/slide/9', day: d, visitor_hash: 'a' },
    { path: '/kit/out/pdf', day: d, visitor_hash: 'a' },
    { path: '/mediakit', day: d, visitor_hash: 'b', browser: 'Chrome', utm_source: 'zzzzzz' },
    { path: '/kit/scroll/25', day: d, visitor_hash: 'b' },
  ]
  const r = analyseKit(rows, 7, d, { k7q2xm: 'Samsung MY' })
  assert.deepEqual(r.tags, [{ code: 'k7q2xm', visitors: 1, views: 1, finished: 1, work: 0, pdf: 1, emailed: 0 }])
  assert.ok(r.sources.some(s => s.label === 'Tag: Samsung MY'))
  assert.ok(!r.sources.some(s => s.label.includes('k7q2xm')))
})
