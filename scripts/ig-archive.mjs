// Build the showcase (lib/showcase.json + public/img/work/) from two years of
// Instagram posts, using the Composio CLI you are logged into — like ig-refresh.
//
//   npm run ig:archive            the last 2 years
//   npm run ig:archive -- 365     the last 365 days
//   npm run ig:archive -- --cached  re-pick from the last fetch (.ig-archive.json,
//                                   git-ignored) without asking Instagram again
//
// Lists every post in the window (12 a page — bigger pages with captions come
// back empty), asks Instagram for each post's reach, lets lib/showcase.ts pick
// one tile per kind of work, then saves those covers locally: Instagram's image
// URLs expire within days, so the pages never link to them.
// Re-run whenever new work should be able to make the showcase.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { insightsFor } from '../lib/ig-fetch.ts'
import { pickShowcase, median } from '../lib/showcase.ts'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`
const exec = async (slug, args) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await run(CLI, ['execute', slug, '-d', JSON.stringify(args)], {
        maxBuffer: 1 << 26,
        env: { ...process.env, NO_COLOR: '1' },
      })
      const json = JSON.parse(stdout)
      if (json.successful === false) throw new Error(`${slug}: ${json.error ?? 'failed'}`)
      return json
    } catch (e) {
      // Instagram's paging throws the odd transient 500; insights failures are final.
      if (attempt >= 2 || slug === 'INSTAGRAM_GET_IG_MEDIA_INSIGHTS') throw e
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

const args = process.argv.slice(2)
const days = Number(args.find(a => Number(a) > 0)) || 730
const CACHE = fileURLToPath(new URL('../.ig-archive.json', import.meta.url))
const cached = args.includes('--cached') && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : null
const since = cached?.since ?? new Date(Date.now() - days * 86_400_000).toISOString()
const info = await exec('INSTAGRAM_GET_USER_INFO', {})
const igUserId = String(info?.data?.id ?? '')
if (!igUserId) throw new Error('Instagram account id missing')

// 1 — every post in the window, newest first
const posts = cached?.posts ?? []
let after
for (let page = 0; page < 300 && !cached; page++) {
  const res = await exec('INSTAGRAM_GET_IG_USER_MEDIA', {
    ig_user_id: igUserId,
    limit: 12,
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count',
    ...(after ? { after } : {}),
  })
  const items = res?.data?.data ?? []
  for (const m of items)
    posts.push({
      id: String(m.id),
      timestamp: String(m.timestamp ?? ''),
      type: String(m.media_product_type ?? m.media_type ?? 'FEED'),
      caption: String(m.caption ?? '').replace(/\s+/g, ' ').trim(),
      permalink: m.permalink ? String(m.permalink) : undefined,
      likes: Number(m.like_count ?? 0),
    })
  after = res?.data?.paging?.cursors?.after
  process.stdout.write(`\rListed ${posts.length} posts…`)
  if (!items.length || !after || items.at(-1).timestamp < since) break
}
const window = posts.filter(p => p.timestamp >= since)
console.log(`\rListed ${window.length} posts since ${since.slice(0, 10)}.`)

// 2 — reach for each (same per-format metric lists as the daily refresh)
if (!cached) {
  await insightsFor(exec, window)
  writeFileSync(CACHE, JSON.stringify({ since, posts: window }))
}
const withReach = window.filter(p => p.reach !== undefined)
console.log(`Reach for ${withReach.length}/${window.length}; median ${median(withReach.map(p => p.reach))}.`)
// A throttled run would skew the median and the picks — stop rather than save that.
if (withReach.length < window.length * 0.9) {
  console.error('❌ Instagram gave reach for under 90% of posts (rate limit?). Nothing saved — try again later.')
  if (!cached) rmSync(CACHE, { force: true })
  process.exit(1)
}
// sharp ships with Next.js rather than being a direct dependency, so load it carefully.
const sharp = await import('sharp').then(m => m.default).catch(() => {
  console.error('❌ sharp is not installed — run npm install first.')
  process.exit(1)
})

// 3 — pick, then save each cover locally
const picks = pickShowcase(window)
const dir = fileURLToPath(new URL('../public/img/work/', import.meta.url))
mkdirSync(dir, { recursive: true })
const items = []
for (const p of picks) {
  try {
    const m = await exec('INSTAGRAM_GET_IG_MEDIA', { ig_media_id: p.id, fields: 'id,media_type,media_url,thumbnail_url' })
    const url = /VIDEO/i.test(String(m.data?.media_type)) ? m.data?.thumbnail_url : (m.data?.media_url ?? m.data?.thumbnail_url)
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`cover HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await sharp(buf).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(`${dir}${p.id}.jpg`)
    items.push({ ...p, cover: `/img/work/${p.id}.jpg` })
    console.log(`  ✓ ${p.label.padEnd(20)} ${String(p.reach).padStart(8)}  ${p.caption.slice(0, 60)}`)
  } catch (e) {
    console.warn(`  ✗ ${p.label}: ${e.message} — left out`)
  }
}
// Covers no longer picked are removed, so the folder holds only what is shown.
const keep = new Set(items.map(i => `${i.id}.jpg`))
for (const f of readdirSync(dir)) if (!keep.has(f)) rmSync(`${dir}${f}`)

writeFileSync(
  new URL('../lib/showcase.json', import.meta.url),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      since: since.slice(0, 10),
      posts: window.length,
      median_reach: median(withReach.map(p => p.reach)),
      items,
    },
    null,
    2,
  ) + '\n',
)
console.log(`✅ Showcase saved: ${items.length} tiles.`)
