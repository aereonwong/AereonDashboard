// Refresh Instagram from THIS computer, using the Composio CLI you already
// logged into (`composio login`). No Composio API key needed.
//
//   npm run ig:refresh          posts + account picture, saved like the app does
//   npm run ig:refresh -- 10    only the newest 10 posts
//
// It loads lib/ig-fetch.ts directly (Node 22.18+ strips the types), so the
// shaping is the very same code the app runs.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { buildSnapshot, buildAccount, persist, MAX_POSTS } from '../lib/ig-fetch.ts'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`

async function exec(slug, args) {
  const { stdout } = await run(CLI, ['execute', slug, '-d', JSON.stringify(args)], {
    maxBuffer: 1 << 26,
    env: { ...process.env, NO_COLOR: '1' },
  })
  const json = JSON.parse(stdout)
  if (json.successful === false) throw new Error(`${slug}: ${json.error ?? 'failed'}`)
  return json
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const arg = process.argv.slice(2).map(Number).find(v => Number.isFinite(v) && v > 0)
const snap = await buildSnapshot(exec, arg ?? MAX_POSTS)
if (snap.posts.length === 0) {
  console.error('❌ Instagram returned no posts — nothing saved (the old snapshot stays).')
  process.exit(1)
}
const account = await buildAccount(exec, String(snap.profile.id ?? '')).catch(e => {
  console.warn('⚠️  Account insights unavailable:', e.message)
  return null
})
try {
  const warnings = await persist(createClient(url, key), snap, account)
  for (const w of warnings) console.warn('⚠️ ', w)
} catch (e) {
  console.error('❌ Could not save snapshot:', e.message)
  process.exit(1)
}
console.log(
  `✅ Saved @${snap.username}: ${snap.posts.length} posts, ${snap.profile.followers_count} followers` +
    (account ? `, ${account.daily.length} days of account figures` : ''),
)
