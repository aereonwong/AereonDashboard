// Unit tests for the /hello link page config. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanHello, cleanUrl, collabMailto, DEFAULT_HELLO, LIMITS } from '../lib/hello-config.ts'

test('only http(s) and mailto links survive', () => {
  assert.equal(cleanUrl('javascript:alert(1)'), '')
  assert.equal(cleanUrl('data:text/html,hi'), '')
  assert.equal(cleanUrl('JaVaScRiPt:alert(1)'), '')
  assert.equal(cleanUrl('shopee.com.my/x'), 'https://shopee.com.my/x')
  assert.equal(cleanUrl('mailto:a@b.co'), 'mailto:a@b.co')
  assert.equal(cleanUrl(42), '')
})

test('garbage in, valid config out', () => {
  assert.deepEqual(cleanHello(null), DEFAULT_HELLO)
  const c = cleanHello({
    tagline: '  ', topics: ['A', '', 'B', 5],
    links: [
      { label: 'Ok', url: 'example.com' },
      { label: 'Ok', url: 'https://x.com', on: false },
      { label: '', url: 'https://x.com' },
      { label: 'Bad', url: 'javascript:1' },
    ],
    extra: 'dropped',
  })
  assert.equal(c.tagline, DEFAULT_HELLO.tagline)
  assert.deepEqual(c.topics, ['A', 'B'])
  assert.equal(c.links.length, 2)
  assert.notEqual(c.links[0].id, c.links[1].id)
  assert.equal(c.links[1].on, false)
  assert.ok(!('extra' in c))
})

test('limits are enforced', () => {
  const c = cleanHello({ tagline: 'x'.repeat(500), links: Array.from({ length: 40 }, (_, i) => ({ label: `L${i}`, url: 'https://a.co' })) })
  assert.equal(c.tagline.length, LIMITS.tagline)
  assert.equal(c.links.length, LIMITS.links)
})

test('collab mailto carries topic and a brief', () => {
  const m = collabMailto('collab@aereonwong.com', 'Travel & hotel')
  assert.ok(m.startsWith('mailto:collab@aereonwong.com?subject='))
  assert.ok(decodeURIComponent(m).includes('Collab enquiry: Travel & hotel'))
  assert.ok(decodeURIComponent(m).includes('Budget range'))
})

test('affiliates: own list, codes kept, bad links dropped, ids unique across lists', () => {
  const c = cleanHello({
    links: [{ id: 'gear', label: 'Gear', url: 'a.co' }],
    affiliates: [
      { id: 'gear', label: 'DJI Mini', url: 'https://dji.com/x', code: '  AEREON10 ' },
      { label: 'Bad', url: 'javascript:1', code: 'X' },
    ],
  })
  assert.equal(c.affiliates.length, 1)
  assert.equal(c.affiliates[0].code, 'AEREON10')
  assert.notEqual(c.affiliates[0].id, c.links[0].id)
  assert.ok(!('code' in c.links[0]))
  assert.equal(c.affiliateTitle, DEFAULT_HELLO.affiliateTitle)
  assert.equal(cleanHello({ affiliateNote: "" }).affiliateNote, "")
  assert.deepEqual(cleanHello({}).affiliates, [])
})

test('affiliate kind defaults to deal; briefs differ per audience', async () => {
  const { briefMailto } = await import('../lib/hello-config.ts')
  const c = cleanHello({ affiliates: [{ label: 'A', url: 'a.co' }, { label: 'B', url: 'b.co', kind: 'gear' }, { label: 'C', url: 'c.co', kind: 'evil' }] })
  assert.deepEqual(c.affiliates.map(a => a.kind), ['deal', 'gear', 'deal'])
  assert.ok(decodeURIComponent(briefMailto('x@y.co', 'drone')).includes('Drone pilot enquiry'))
  assert.ok(decodeURIComponent(briefMailto('x@y.co', 'visitor')).includes('Dates you are in Kuala Lumpur'))
})

test('only well-formed /hello tap events are tracked', async () => {
  const { isTrackedPath } = await import('../lib/site-visits.ts')
  for (const p of ['/hello', '/hello/tap/collab', '/hello/out/icity', '/hello/out/mail-drone']) assert.ok(isTrackedPath(p), p)
  for (const p of ['/hello/x', '/hello/tap/', '/hello/tap/nope', '/hello/out/A', '/hello/out/a/b', '/dashboard', '/hello/tap/' + 'a'.repeat(41)]) assert.ok(!isTrackedPath(p), p)
})

test('insights: funnel, per-section rate, sources and in-app detection', async () => {
  const { analyseHello, sourceOf } = await import('../lib/hello-insights.ts')
  const { parseUa } = await import('../lib/site-visits.ts')
  assert.equal(parseUa('Mozilla/5.0 (iPhone) Instagram 300.0').browser, 'Instagram app')
  assert.equal(parseUa('Mozilla/5.0 (iPhone) Safari/604.1').browser, 'Safari')
  assert.equal(sourceOf({ browser: 'Instagram app' }), 'Instagram')
  assert.equal(sourceOf({ browser: 'Chrome', utm_source: 'story' }), 'Tag: story')
  assert.equal(sourceOf({ browser: 'Safari', utm_source: 'ig' }), 'Instagram')
  assert.equal(sourceOf({ browser: 'Chrome', referrer_host: 'l.facebook.com' }), 'Facebook')
  assert.equal(sourceOf({ browser: 'Chrome' }), 'Direct or unknown')

  const cfg = cleanHello({ affiliates: [{ id: 'icity', label: 'i-City', url: 'a.co', kind: 'deal' }] })
  const d = '2026-10-12'
  const rows = [
    { path: '/hello', day: d, visitor_hash: 'a', browser: 'Instagram app', country: 'MY', city: 'Kuala Lumpur', device: 'mobile' },
    { path: '/hello/tap/drone', day: d, visitor_hash: 'a' },
    { path: '/hello/out/mail-drone', day: d, visitor_hash: 'a' },
    { path: '/hello', day: d, visitor_hash: 'b', country: 'SG', device: 'mobile' },
    { path: '/hello/tap/drone', day: d, visitor_hash: 'b' },
    { path: '/hello/tap/deals', day: d, visitor_hash: 'b' },
    { path: '/hello/out/icity', day: d, visitor_hash: 'b' },
    { path: '/hello/out/made-up', day: d, visitor_hash: 'b' },
    { path: '/hello', day: '2026-10-11', visitor_hash: 'c', device: 'desktop' },
  ]
  const r = analyseHello(rows, cfg, 7, d)
  assert.equal(r.visitors, 3)
  assert.equal(r.opened, 2)
  assert.equal(r.emailed, 1)
  assert.equal(r.promo, 1)
  assert.deepEqual(r.sections.find(s => s.id === 'drone'), { id: 'drone', label: 'Drone Pilot', opened: 2, acted: 1 })
  assert.deepEqual(r.sections.find(s => s.id === 'deals'), { id: 'deals', label: 'Attractions', opened: 1, acted: 1 })
  assert.ok(!r.clicks.some(c => c.id === 'made-up'))
  assert.equal(r.daily.length, 7)
  assert.equal(r.daily.at(-1).visitors, 2)
  assert.equal(r.sources.find(s => s.label === 'Instagram').count, 1)
  assert.equal(r.countries[0].label.length > 2, true)
})
