// Store every public TikTok video once, with its figures today, so the dashboard reads the
// database instead of asking TikTok again. Needs supabase/tiktok.sql.
//
//   npm run tt:backfill                      account totals + every public video
//   npm run tt:backfill -- --since=2025-01-01   only videos posted from this date
//
// The TikTok connection lives in the dashboard's Composio PROJECT (user "aereon"), not in your
// personal Composio login, so calls go through `composio dev playground-execute` against that
// project. Safe to run again: it just adds a fresh reading per video.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { fetchAccount, fetchVideos, persist } from '../lib/tt-fetch.ts'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`
const USER = process.env.COMPOSIO_USER_ID || 'aereon'
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const SINCE = arg('since')

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
const exec = async (slug, args) => {
  calls++
  if (calls % 10 === 0) console.log(`   ${calls} TikTok calls…`)
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

const account = await fetchAccount(exec)
console.log(`✅ @${account.username}: ${account.followers} followers, ${account.likes} likes, ${account.video_count} videos`)
const { posts, metrics } = await fetchVideos(exec, account.username, new Date().toISOString(), { since: SINCE })
await persist(db, { account, posts, metrics })
console.log(`✅ ${posts.length} public videos${SINCE ? ` since ${SINCE}` : ''} stored · ${calls} TikTok calls`)
