// Store Facebook Page history once, so the dashboard reads the database instead
// of asking Facebook again. Needs supabase/facebook.sql.
//
//   npm run fb:backfill                    page figures + posts + post views
//   npm run fb:backfill -- --page          only the day-by-day page figures
//   npm run fb:backfill -- --posts         only posts and their views
//   npm run fb:backfill -- --since=2025-01-01   posts from this date (default 1 Jan 2025)
//   npm run fb:backfill -- --pace=900      calls per hour (default 600)
//
// The Facebook connection lives in the dashboard's Composio PROJECT (user "aereon"),
// not in your personal Composio login, so calls go through `composio dev
// playground-execute` against that project. Resumable: posts that already have a
// views row are skipped.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_PAGE_ID, fetchDaily, fetchPeriods, fetchPosts, postMetrics, persist } from '../lib/fb-fetch.ts'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`
const USER = process.env.COMPOSIO_USER_ID || 'aereon'
const PAGE = process.env.FB_PAGE_ID || DEFAULT_PAGE_ID

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const PACE = Number(arg('pace')) || 600
const SINCE = arg('since') || '2025-01-01'
// Facebook's view figures start in Aug 2024 for this Page; follower counts go further back.
const PAGE_FROM = arg('page-from') || '2024-08-01'
const flags = process.argv.slice(2)
const doPage = !flags.includes('--posts')
const doPosts = !flags.includes('--page')

// The Composio project: COMPOSIO_PROJECT_NAME, or the only project this login has.
async function project() {
  if (process.env.COMPOSIO_PROJECT_NAME) return process.env.COMPOSIO_PROJECT_NAME
  const { stdout } = await run(CLI, ['dev', 'projects', 'list'], { env: { ...process.env, NO_COLOR: '1' } })
  const list = JSON.parse(stdout.slice(stdout.indexOf('[')))
  if (list.length !== 1) throw new Error('Several Composio projects — set COMPOSIO_PROJECT_NAME in .env')
  return list[0].name
}
const PROJECT = await project()

let calls = 0
const started = Date.now()
const breathe = async () => {
  const ahead = (calls / PACE) * 3_600_000 - (Date.now() - started)
  if (ahead > 0) await new Promise(r => setTimeout(r, ahead))
}
const exec = async (slug, args) => {
  calls++
  await breathe()
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await run(
        CLI,
        ['dev', 'playground-execute', slug, '--user-id', USER, '--project-name', PROJECT, '-d', JSON.stringify(args)],
        { maxBuffer: 1 << 26, env: { ...process.env, NO_COLOR: '1' } },
      )
      return JSON.parse(stdout.slice(stdout.indexOf('{')))
    } catch (e) {
      if (attempt >= 2) throw e
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
const today = new Date().toISOString().slice(0, 10)

if (doPage) {
  const days = await fetchDaily(exec, PAGE, PAGE_FROM, today)
  const periods = await fetchPeriods(exec, PAGE, PAGE_FROM, today)
  await persist(db, { days, periods })
  console.log(`✅ Page: ${days.length} days, ${periods.length} 28-day windows (${PAGE_FROM} → ${today})`)
}

if (doPosts) {
  const posts = await fetchPosts(exec, PAGE, SINCE)
  await persist(db, { posts })
  console.log(`✅ Posts: ${posts.length} since ${SINCE}`)

  const { data: have, error } = await db.from('fb_post_metrics').select('post_id').limit(100000)
  if (error) throw new Error(error.message)
  const done = new Set((have ?? []).map(r => r.post_id))
  const todo = posts.filter(p => !done.has(p.post_id))
  console.log(`   views for ${todo.length} posts (${done.size} already stored) at ${PACE} calls/hour…`)
  const at = new Date().toISOString()
  for (let i = 0; i < todo.length; i += 20) {
    const metrics = await postMetrics(exec, todo.slice(i, i + 20), at, 1)
    await persist(db, { metrics })
    console.log(`   ${Math.min(i + 20, todo.length)}/${todo.length}`)
  }
}
console.log(`Done · ${calls} Facebook calls`)
