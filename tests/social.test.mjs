// Social overview maths (lib/v3/social-math.ts): one views-based currency on every platform,
// honest totals, and platforms picked up from their sources — not from a hard-coded list.
import test from 'node:test'
import assert from 'node:assert/strict'

const NOW = Date.parse('2026-10-17T04:00:00Z') // noon in Malaysia
const day = n => new Date(NOW - n * 86_400_000).toISOString()
const post = (platform, n, views, interactions = null, kind = 'Video', people = null) => ({
  platform, id: `${platform}${n}-${views}`, at: day(n), title: 't', kind, views, people, interactions, permalink: null, thumb: null,
})
const src = (id, extra = {}) => ({
  id, followers: 1000, net30: null, fresh: true, followerDays: [], peopleDays: null, people: null, posts: [], ...extra,
})

test('views, interactions and rate read posts published in the window, on every platform alike', async () => {
  const { buildSocial } = await import('../lib/v3/social-math.ts')
  const s = buildSocial(
    [
      src('ig', { posts: [post('ig', 2, 1000, 100), post('ig', 5, 3000, 150), post('ig', 40, 9999, 999)] }),
      src('tt', { posts: [post('tt', 1, 500, 50), post('tt', 3, null, null)] }),
    ],
    30,
    NOW,
  )
  assert.deepEqual(s.ids, ['ig', 'tt'])
  assert.equal(s.by.ig.views, 4000) // the 40-day-old post is outside the window
  assert.equal(s.by.ig.typical, 2000) // median views
  assert.equal(s.by.tt.views, 500) // the unread video sits out…
  assert.equal(s.by.tt.unread, 1) // …and is counted
  assert.equal(s.total.views, 4500)
  assert.equal(s.total.interactions, 300)
  assert.ok(Math.abs(s.total.rate - (300 / 4500) * 100) < 1e-9)
  assert.equal(s.total.posts, 4)
})

test('platforms come in fixed order whatever order the sources arrive in; a missing one is simply absent', async () => {
  const { buildSocial } = await import('../lib/v3/social-math.ts')
  const s = buildSocial([src('tt'), null, src('fb'), src('ig')], 30, NOW)
  assert.deepEqual(s.ids, ['ig', 'fb', 'tt'])
  assert.equal(s.total.followers, 3000)
})

test('people reached adds only platforms that measure it, and hides when one of them cannot say', async () => {
  const { buildSocial } = await import('../lib/v3/social-math.ts')
  const ok = buildSocial([src('ig', { people: { value: 700, window: 30 } }), src('fb', { people: { value: 300, window: 28 } }), src('tt')], 30, NOW)
  assert.equal(ok.total.people, 1000)
  assert.deepEqual(ok.total.peopleOf, ['ig', 'fb'])
  const stale = buildSocial([src('ig', { people: { value: 700, window: 30 } }), src('fb', { people: { value: null, window: 28 } })], 30, NOW)
  assert.equal(stale.total.people, null)
})

test('follower change covers the platforms that have 30 days of history, and says which', async () => {
  const { buildSocial } = await import('../lib/v3/social-math.ts')
  const s = buildSocial([src('ig', { net30: 120 }), src('fb', { net30: -20 }), src('tt', { net30: null })], 30, NOW)
  assert.equal(s.total.net30, 100)
  assert.deepEqual(s.total.netOf, ['ig', 'fb'])
})

test('posts rank by lift over their own platform’s typical post', async () => {
  const { buildSocial } = await import('../lib/v3/social-math.ts')
  const s = buildSocial(
    [
      src('ig', { posts: [post('ig', 1, 10000), post('ig', 2, 10000), post('ig', 3, 30000)] }),
      src('tt', { posts: [post('tt', 1, 100), post('tt', 2, 100), post('tt', 3, 500)] }),
    ],
    30,
    NOW,
  )
  // TikTok's 500 is 5× its typical 100; Instagram's 30K is only 3×.
  assert.equal(s.ranked[0].platform, 'tt')
  assert.equal(s.ranked[0].lift, 5)
  assert.equal(s.ranked[1].lift, 3)
  assert.equal(s.by.tt.hits, 1)
})

test('followers gained are indexed to each platform’s first reading; months stack views by posting month', async () => {
  const { buildSocial } = await import('../lib/v3/social-math.ts')
  const d = n => new Date(NOW + 8 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10)
  const s = buildSocial(
    [src('ig', { followerDays: [[d(10), 50000], [d(5), 50040], [d(0), 50100]], posts: [post('ig', 1, 700), post('ig', 2, 300)] })],
    30,
    NOW,
  )
  const vals = s.followers.map(r => r.v.ig).filter(v => v !== null)
  assert.deepEqual(vals, [0, 40, 100])
  assert.equal(s.level.ig, 50100)
  assert.equal(s.months.length, 12)
  assert.equal(s.months.at(-1).key, '2026-10')
  assert.equal(s.months.at(-1).v.ig, 1000)
  assert.equal(s.months[0].v.ig, null) // nothing posted then: a gap, not zero
})
