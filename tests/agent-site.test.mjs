// Unit tests for the public/agent-facing side. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync } from 'node:fs'
import {
  PAGES, PRIVATE_SEGMENTS, API_SEGMENTS, MARKDOWN_PATHS, AI_AGENTS,
  isPublicPath, isKnownPrivatePath, wantsMarkdown, markdownFor, notFoundMarkdown, llmsTxt, jsonLd, sitemapEntries,
} from '../lib/agent-site.ts'

const dirs = p => readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name)

test('private segment list matches app/(app) folders', () => {
  assert.deepEqual([...PRIVATE_SEGMENTS].sort(), dirs('app/(app)').sort())
})
test('api segment list matches app/api folders', () => {
  assert.deepEqual([...API_SEGMENTS].sort(), dirs('app/api').sort())
})
test('every public page has a route file', () => {
  for (const p of PAGES) assert.ok(existsSync(`app${p.path}/page.tsx`), p.path)
})

test('public vs private vs unknown', () => {
  for (const p of ['/', '/about', '/login', '/api/telegram', '/api/auth/google/callback', '/robots.txt', '/llms.txt', '/sitemap.xml', '/manifest.webmanifest'])
    assert.ok(isPublicPath(p), p)
  for (const p of ['/login-admin', '/api/auth', '/dashboard', '/api/demo', '/about/x', '/imgs-private'])
    assert.ok(!isPublicPath(p), p)
  assert.ok(isKnownPrivatePath('/dashboard') && isKnownPrivatePath('/clients/abc') && isKnownPrivatePath('/api/demo'))
  for (const p of ['/', '/nope', '/api/nope', '/api', '/Dashboard']) assert.ok(!isKnownPrivatePath(p), p)
})

test('wantsMarkdown negotiates, it does not just sniff', () => {
  assert.ok(wantsMarkdown('text/markdown'))
  assert.ok(wantsMarkdown('text/markdown, text/html;q=0.5'))
  assert.ok(!wantsMarkdown('text/html'))
  assert.ok(!wantsMarkdown('text/html,application/xhtml+xml,*/*;q=0.8'))
  assert.ok(!wantsMarkdown('text/html, text/markdown;q=0.1'))
  assert.ok(!wantsMarkdown('text/markdown;q=0'))
  assert.ok(!wantsMarkdown(''))
  assert.ok(!wantsMarkdown(null))
})

test('markdown twins exist for every negotiable path and are non-trivial', () => {
  for (const p of MARKDOWN_PATHS) {
    const md = markdownFor(p)
    assert.ok(md && md.startsWith('# ') && md.length > 200, p)
  }
  assert.equal(markdownFor('/nope'), null)
})

test('trust pages have at least 500 characters of content', () => {
  for (const p of PAGES) {
    const text = p.sections.flatMap(s => s.body).join(' ')
    assert.ok(text.length >= 500, `${p.path} has ${text.length}`)
  }
})

test('404 markdown explains the error and points to llms.txt and sitemap', () => {
  const md = notFoundMarkdown('/x`\ny')
  assert.ok(md.length > 20 && md.includes('/llms.txt') && md.includes('/sitemap.xml') && md.includes('404'))
  assert.ok(!md.includes('`\n'))
})

test('llms.txt follows the format and has when-to-use guidance', () => {
  const t = llmsTxt()
  assert.ok(t.startsWith('# ') && t.includes('\n> '))
  assert.match(t, /## When to use this site/)
  assert.match(t, /## How an agent should call it/)
})

test('JSON-LD: Person, Organization with contactPoint + PostalAddress', () => {
  const g = jsonLd()['@graph']
  assert.ok(g.some(n => n['@type'] === 'Person'))
  const org = g.find(n => n['@type'] === 'Organization')
  assert.equal(org.address['@type'], 'PostalAddress')
  assert.ok(org.contactPoint.email && org.contactPoint.contactType)
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(jsonLd())))
})

test('sitemap lists every public page with lastmod; robots names the agents asked about', () => {
  const s = sitemapEntries()
  assert.equal(s.length, PAGES.length + 1)
  assert.ok(s.every(e => e.url.startsWith('https://aereonwong.com') && /^\d{4}-\d\d-\d\d$/.test(e.lastModified)))
  for (const a of ['ChatGPT-User', 'ClaudeBot', 'Google-Extended', 'ora-agent', 'DeepSeekBot']) assert.ok(AI_AGENTS.includes(a), a)
})

test('no CAAM wording in public agent content', () => {
  const all = [llmsTxt(), JSON.stringify(jsonLd()), ...MARKDOWN_PATHS.map(markdownFor)].join(' ')
  assert.ok(!/caam/i.test(all))
})
