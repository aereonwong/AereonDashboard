// Live checks of every public endpoint. Run against a running app:
//   BASE_URL=http://localhost:3100 npm test      (skipped when BASE_URL is not set)
import test from 'node:test'
import assert from 'node:assert/strict'

const base = process.env.BASE_URL
const get = (path, accept) => fetch(base + path, { redirect: 'manual', headers: accept ? { Accept: accept } : {} })
const t = base ? test : test.skip

t('unknown path: real 404, Markdown body for agents', async () => {
  const r = await get('/some-path-that-does-not-exist', 'text/markdown')
  assert.equal(r.status, 404)
  assert.match(r.headers.get('content-type'), /^text\/markdown/)
  const b = await r.text()
  assert.ok(b.length > 20 && b.includes('llms.txt'))
})
t('unknown path: 404 HTML for browsers, nested and API too', async () => {
  for (const p of ['/nope', '/api/nope', '/nope/deeper']) {
    const r = await get(p, 'text/html')
    assert.equal(r.status, 404, p)
    assert.match(r.headers.get('content-type'), /html/)
  }
})
t('private pages still redirect to /login when signed out', async () => {
  for (const p of ['/dashboard', '/clients', '/property/loans']) {
    const r = await get(p)
    assert.equal(r.status, 307, p)
    assert.match(r.headers.get('location'), /\/login$/)
  }
})
t('markdown negotiation on every public page, HTML otherwise, Vary: Accept on Markdown', async () => {
  for (const p of ['/', '/about', '/contact', '/privacy']) {
    const m = await get(p, 'text/markdown')
    assert.equal(m.status, 200, p)
    assert.match(m.headers.get('content-type'), /^text\/markdown/)
    assert.match(m.headers.get('vary') ?? '', /(^|,\s*)accept\s*(,|$)/i)
    assert.ok((await m.text()).startsWith('# '))
    const h = await get(p, 'text/html')
    assert.equal(h.status, 200)
    assert.match(h.headers.get('content-type'), /^text\/html/)
  }
})
t('homepage HTML: JSON-LD, canonical, og tags, lang', async () => {
  const html = await (await get('/', 'text/html')).text()
  assert.match(html, /<html lang="en"/)
  assert.match(html, /<link rel="canonical" href="https:\/\/aereonwong\.com\/?"/)
  assert.match(html, /property="og:image"/)
  assert.match(html, /property="og:type" content="website"/)
  const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
  assert.ok(ld)
  const g = JSON.parse(ld[1])['@graph']
  assert.ok(g.some(n => n['@type'] === 'Organization' && n.contactPoint && n.address))
})
t('machine files', async () => {
  const llms = await get('/llms.txt')
  assert.equal(llms.status, 200)
  assert.match(await llms.text(), /When to use this site/)
  const robots = await (await get('/robots.txt')).text()
  for (const a of ['ChatGPT-User', 'ClaudeBot', 'Google-Extended', 'ora-agent', 'DeepSeekBot']) assert.match(robots, new RegExp(`User-Agent: ${a}`, 'i'))
  assert.match(robots, /Sitemap: https:\/\/aereonwong\.com\/sitemap\.xml/)
  const sm = await get('/sitemap.xml')
  assert.equal(sm.status, 200)
  assert.match(sm.headers.get('content-type'), /xml/)
  assert.match(await sm.text(), /<lastmod>/)
})
t('public trust pages have 500+ characters of text', async () => {
  for (const p of ['/about', '/contact', '/privacy']) {
    const html = await (await get(p, 'text/html')).text()
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
    assert.ok(text.length > 500, p)
  }
})
t('existing public routes keep working', async () => {
  for (const p of ['/login', '/manifest.webmanifest', '/icons/icon-192.png', '/img/aereon.jpg']) assert.equal((await get(p)).status, 200, p)
})
