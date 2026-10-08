// Store everything Instagram will give, once, so analytics read the database
// instead of asking Instagram (or Claude) again. Uses the Composio CLI you are
// logged into, like ig-refresh. Needs supabase/instagram-archive.sql.
//
//   npm run ig:backfill              posts + insights + account history
//   npm run ig:backfill -- --posts   only the post list and post insights
//   npm run ig:backfill -- --account only account windows and daily reach
//   npm run ig:backfill -- --pace=900 calls per hour (default 600)
//
// Resumable: posts that already have a metrics row are skipped, so a run cut
// short by Instagram's rate limit just carries on next time. The post list is
// cached in .ig-backfill.json (git-ignored) for the same reason.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { insightsFor, postRows } from '../lib/ig-fetch.ts'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`
// Pacing. Instagram's limit is per 24 h and depends on the account's activity
// (Meta's Business Use Case limit); its exact size isn't published per account.
// Every call is counted and the run is held to --pace calls per hour (default 600),
// well under anything this account has hit before, so a full back-fill never trips it.
const PACE = Number(process.argv.find(a => a.startsWith('--pace='))?.split('=')[1]) || 600
let calls = 0
const started = Date.now()
const breathe = async () => {
  const ahead = (calls / PACE) * 3_600_000 - (Date.now() - started)
  if (ahead > 0) await new Promise(r => setTimeout(r, ahead))
}
const exec = async (slug, args) => {
  calls++
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await run(CLI, ['execute', slug, '-d', JSON.stringify(args)], { maxBuffer: 1 << 26, env: { ...process.env, NO_COLOR: '1' } })
      const json = JSON.parse(stdout)
      if (json.successful === false) throw new Error(`${slug}: ${json.error ?? 'failed'}`)
      return json
    } catch (e) {
      if (attempt >= 2 || slug === 'INSTAGRAM_GET_IG_MEDIA_INSIGHTS') throw e
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
const db = createClient(url, key)
const args = process.argv.slice(2)
const doPosts = !args.includes('--account')
const doAccount = !args.includes('--posts')

const info = await exec('INSTAGRAM_GET_USER_INFO', {})
const id = String(info?.data?.id ?? '')
if (!id) throw new Error('Instagram account id missing')

// ------------------------------------------------------------------ posts
if (doPosts) {
  const CACHE = fileURLToPath(new URL('../.ig-backfill.json', import.meta.url))
  // The cached list is reused for a day (resuming a throttled run); --refresh or an
  // older cache lists again, so new posts and current likes are picked up.
  const fresh = existsSync(CACHE) && !args.includes('--refresh') && Date.now() - statSync(CACHE).mtimeMs < 86_400_000
  let posts = fresh ? JSON.parse(readFileSync(CACHE, 'utf8')) : null
  if (!posts) {
    posts = []
    let after
    // 12 a page: bigger pages with captions come back empty.
    for (let page = 0; page < 1000; page++) {
      const res = await exec('INSTAGRAM_GET_IG_USER_MEDIA', {
        ig_user_id: id,
        limit: 12,
        fields: 'id,caption,media_type,media_product_type,permalink,shortcode,timestamp,like_count,comments_count',
        ...(after ? { after } : {}),
      })
      const items = res?.data?.data ?? []
      for (const m of items) posts.push(m)
      await breathe()
      after = res?.data?.paging?.cursors?.after
      process.stdout.write(`\rListed ${posts.length} posts…`)
      if (!items.length || !after) break
    }
    writeFileSync(CACHE, JSON.stringify(posts))
  }
  console.log(`\rListed ${posts.length} posts.`)

  const rows = posts.map(m => ({
    media_id: String(m.id),
    shortcode: m.shortcode ?? m.permalink?.match(/\/(?:p|reel|tv)\/([^/]+)/)?.[1] ?? null,
    posted_at: m.timestamp ?? null,
    type: m.media_product_type ?? null,
    media_type: m.media_type ?? null,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    likes: typeof m.like_count === 'number' ? m.like_count : null,
    comments: typeof m.comments_count === 'number' ? m.comments_count : null,
    updated_at: new Date().toISOString(),
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('ig_posts').upsert(rows.slice(i, i + 500), { onConflict: 'media_id' })
    if (error) throw new Error(`ig_posts: ${error.message}`)
  }
  console.log(`✅ ig_posts: ${rows.length} posts saved.`)

  // Insights only for posts that have none stored yet.
  const have = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('ig_post_metrics').select('media_id').range(from, from + 999)
    if (error) throw new Error(`ig_post_metrics: ${error.message}`)
    for (const r of data) have.add(r.media_id)
    if (data.length < 1000) break
  }
  const todo = posts
    .filter(m => !have.has(String(m.id)))
    .map(m => ({
      id: String(m.id),
      timestamp: m.timestamp ?? '',
      type: String(m.media_product_type ?? 'FEED'),
      caption: '',
      // A hidden count stays missing (null in the table), never 0.
      likes: typeof m.like_count === 'number' ? m.like_count : undefined,
      comments: typeof m.comments_count === 'number' ? m.comments_count : undefined,
    }))
  console.log(`Insights to fetch: ${todo.length} (${have.size} already stored).`)
  let saved = 0
  for (let i = 0; i < todo.length; i += 25) {
    const chunk = todo.slice(i, i + 25)
    await breathe()
    await insightsFor(exec, chunk)
    const got = chunk.filter(p => p.reach !== undefined || p.views !== undefined)
    // Nothing back for a whole chunk means Instagram is throttling: stop and resume later.
    if (!got.length) {
      console.warn(`\n⚠️  Instagram stopped answering (rate limit?) after ${saved} posts. Run again later to carry on.`)
      break
    }
    // Instagram answered for the rest of the chunk, so a post with no insights simply
    // has none: it is stored with empty metrics (null, not 0) and not asked again.
    const { error } = await db.from('ig_post_metrics').insert(postRows({ captured_at: new Date().toISOString(), posts: chunk }))
    if (error) throw new Error(`ig_post_metrics: ${error.message}`)
    saved += chunk.length
    process.stdout.write(`\rInsights saved for ${saved}/${todo.length}…`)
  }
  console.log(`\n✅ ig_post_metrics: ${saved} posts added.`)
}

// ------------------------------------------------------------------ account
if (doAccount) {
  const TOTALS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'replies', 'profile_views', 'profile_links_taps', 'website_clicks']
  const rowsOf = r => (Array.isArray(r?.data?.data) ? r.data.data : Array.isArray(r?.data) ? r.data : [])
  // A failed call is null — never an empty list that would read as "no data".
  const ask = a => exec('INSTAGRAM_GET_USER_INSIGHTS', { ig_user_id: id, ...a }).then(rowsOf, () => null)
  const slices = row =>
    (row?.total_value?.breakdowns?.[0]?.results ?? [])
      .map(x => ({ key: String(x.dimension_values?.[0] ?? ''), value: Number(x.value ?? 0) }))
      .filter(s => s.key && s.key !== 'DEFAULT_DO_NOT_USE')
  const named = (rs, n) => rs.find(r => r?.name === n)

  const known = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('ig_account_daily').select('day').range(from, from + 999)
    if (error) throw new Error(`ig_account_daily: ${error.message}`)
    for (const d of data) known.add(d.day)
    if (data.length < 1000) break
  }
  // Windows sit on one fixed 30-day grid, anchored on the first run's newest window,
  // so re-runs land on the same (since, until) keys and only add newer windows.
  const { data: last } = await db.from('ig_account_periods').select('until').order('until', { ascending: false }).limit(1)
  const nowS = Math.floor(Date.now() / 1000)
  let now = last?.[0] ? Math.floor(Date.parse(last[0].until) / 1000) : nowS
  while (now + 30 * 86_400 <= nowS) now += 30 * 86_400
  let windows = 0
  let days = 0
  // Instagram answers up to 30 days per question, for about the last two years.
  for (let k = 0; k < 26; k++) {
    const until = now - k * 30 * 86_400
    const since = until - 30 * 86_400
    const win = { period: 'day', metric_type: 'total_value', since, until }
    // One at a time: gentle on the rate limit.
    const totals = await ask({ metric: TOTALS, ...win })
    if (totals === null) {
      console.warn(`\n⚠️  Instagram did not answer for ${new Date(since * 1000).toISOString().slice(0, 10)} (rate limit?). Run again later.`)
      break
    }
    const follow = await ask({ metric: ['reach', 'views'], ...win, breakdown: 'follow_type' })
    const formats = await ask({ metric: ['reach', 'views'], ...win, breakdown: 'media_product_type' })
    const daily = (await ask({ metric: ['reach'], period: 'day', since, until })) ?? []
    const t = Object.fromEntries(totals.map(r => [r?.name, r?.total_value?.value]).filter(([, v]) => typeof v === 'number'))
    if (!Object.keys(t).length) {
      console.log(`Instagram has no account figures before ${new Date(until * 1000).toISOString().slice(0, 10)}.`)
      break
    }
    // A breakdown that failed is left out, so a re-run never blanks good data.
    const row = { since: new Date(since * 1000).toISOString(), until: new Date(until * 1000).toISOString(), totals: t, captured_at: new Date().toISOString() }
    if (follow) row.follow_type = { reach: slices(named(follow, 'reach')), views: slices(named(follow, 'views')) }
    if (formats) row.formats = { reach: slices(named(formats, 'reach')), views: slices(named(formats, 'views')) }
    const { error } = await db.from('ig_account_periods').upsert(row, { onConflict: 'since,until' })
    if (error) throw new Error(`ig_account_periods: ${error.message}`)
    windows++
    // Daily reach: only days not stored yet (the daily refresh owns recent ones).
    // A value's end_time is the NEXT day's start, so the day is the one before.
    const add = []
    for (const v of daily.find(r => r?.name === 'reach')?.values ?? []) {
      if (typeof v?.value !== 'number' || !v.end_time) continue
      const day = new Date(Date.parse(v.end_time) - 86_400_000).toISOString().slice(0, 10)
      if (known.has(day)) continue
      known.add(day)
      add.push({ day, reach: v.value, updated_at: new Date().toISOString() })
    }
    if (add.length) {
      // ignoreDuplicates: a day the cron wrote meanwhile is kept as it is.
      const { error: e2 } = await db.from('ig_account_daily').upsert(add, { onConflict: 'day', ignoreDuplicates: true })
      if (e2) throw new Error(`ig_account_daily: ${e2.message}`)
      days += add.length
    }
    process.stdout.write(`\rAccount: ${windows} windows, ${days} new days…`)
  }
  console.log(`\n✅ ig_account_periods: ${windows} windows · ig_account_daily: ${days} days added.`)
}
