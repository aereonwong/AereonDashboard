'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon from '@/app/_components/Icon'
import type { DetailRow } from '@/lib/invoice-figures'
import type { PickPost, LinkedPost } from '@/lib/ig-link-types'
import { listRecentPosts, loadOlderPosts, setInvoicePosts } from '../ig-actions'

// 👉 Link Instagram posts to one invoice. Optional, and nothing is fetched until
// it's asked for: opening reads the stored posts (newest first, 12 shown),
// "Show more" reveals the rest of what's stored, and only "Load older from
// Instagram" asks Instagram — 12 posts per click.
//
// Words from the job and client name are highlighted in captions as a hint.
// Nothing is linked unless it's ticked; the order stays newest first.

const STEP = 12
const STOP = new Set([
  'event', 'events', 'launch', 'video', 'videos', 'coverage', 'show', 'shows', 'project', 'code', 'with', 'from',
  'photo', 'photos', 'photography', 'videography', 'drone', 'reel', 'reels', 'post', 'posts', 'sdn', 'bhd',
  'malaysia', 'kuala', 'lumpur', 'the', 'and', 'for', 'production', 'content', 'social', 'media',
])
const day = (iso: string) => {
  const d = new Date(String(iso).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })
}
const kind = (t: string) => (/REEL/i.test(t) ? 'Reel' : /STORY/i.test(t) ? 'Story' : 'Post')
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : String(n))
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Highlight({ text, words }: { text: string; words: string[] }): ReactNode {
  if (!words.length) return text
  const parts = text.split(new RegExp(`(${words.map(esc).join('|')})`, 'gi'))
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))
}

export default function LinkPosts({
  row,
  onClose,
  onSaved,
}: {
  row: DetailRow
  onClose: () => void
  onSaved: (text: string, bad?: boolean) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [posts, setPosts] = useState<PickPost[] | null>(null)
  const [shown, setShown] = useState(STEP)
  const [cursor, setCursor] = useState<string | null | undefined>(undefined) // undefined = not asked yet; null = no more
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What is ticked, keyed by id — seeded with what's already linked, so a link to
  // a post outside the loaded list still shows and can be unticked.
  const [picked, setPicked] = useState<Map<string, LinkedPost>>(() => new Map(row.igPosts.map(p => [p.id, p])))

  useEffect(() => {
    ref.current?.showModal()
    listRecentPosts().then(r => (r.ok ? setPosts(r.posts) : (setPosts([]), setError(r.error))))
  }, [])

  // Hint words: from the job and client names, long enough to mean something.
  const words = useMemo(
    () =>
      [...new Set(`${row.project} ${row.client}`.toLowerCase().split(/[^a-z0-9ˣ]+/i))].filter(
        w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w) && !/^sycp/.test(w),
      ),
    [row.project, row.client],
  )

  const list = posts ?? []
  // Already-linked posts that aren't in the loaded list (older ones) stay here,
  // ticked or not, so an untick can be changed back.
  const visible = list.slice(0, shown)
  const outside = row.igPosts.filter(p => !visible.some(x => x.id === p.id))
  const toggle = (p: PickPost | LinkedPost) =>
    setPicked(m => {
      const n = new Map(m)
      if (n.has(p.id)) n.delete(p.id)
      else n.set(p.id, { id: p.id, permalink: p.permalink, timestamp: p.timestamp, type: p.type, caption: p.caption })
      return n
    })

  const loadOlder = async () => {
    setLoading(true)
    setError(null)
    const r = await loadOlderPosts(cursor ?? null)
    setLoading(false)
    if (!r.ok) return setError(r.error)
    setPosts(cur => {
      const have = new Set((cur ?? []).map(p => p.id))
      return [...(cur ?? []), ...r.posts.filter(p => !have.has(p.id))]
    })
    setShown(Infinity)
    setCursor(r.after)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const r = await setInvoicePosts(row.id, [...picked.values()])
    setSaving(false)
    if (!r.ok) return setError(r.error)
    onSaved(r.count ? `${row.no}: ${r.count} post${r.count === 1 ? '' : 's'} linked` : `${row.no}: posts unlinked`)
    onClose()
  }

  const before = new Set(row.igPosts.map(p => p.id))
  const changed = picked.size !== before.size || [...picked.keys()].some(id => !before.has(id))

  return (
    <dialog
      ref={ref}
      className="idt-dialog idt idt-link"
      aria-labelledby="idt-link-title"
      onCancel={e => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="idt-dialog-head">
        <div>
          <h2 id="idt-link-title">Link Instagram posts</h2>
          <p className="idt-sub">
            {row.no} · {row.project || row.client} · optional, newest first
          </p>
        </div>
        <button type="button" className="idt-act" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      <div className="idt-dialog-body">
        {outside.length ? (
          <div className="idt-link-outside">
            <p className="idt-sub">Linked now</p>
            <div className="idt-link-grid">
              {outside.map(p => (
                <Card key={p.id} p={list.find(x => x.id === p.id) ?? p} on={picked.has(p.id)} words={words} onToggle={() => toggle(p)} />
              ))}
            </div>
          </div>
        ) : null}

        {posts === null ? (
          <p className="idt-empty">Loading your recent posts…</p>
        ) : list.length === 0 && !error ? (
          <p className="idt-empty">No stored posts yet — refresh Instagram first, or load older posts.</p>
        ) : (
          <div className="idt-link-grid" role="group" aria-label="Posts">
            {visible.map(p => (
              <Card key={p.id} p={p} on={picked.has(p.id)} words={words} onToggle={() => toggle(p)} />
            ))}
          </div>
        )}

        {error ? (
          <p className="idt-error" role="alert">
            <Icon name="alert" /> {error}
          </p>
        ) : null}

        <div className="idt-link-more">
          {list.length > shown ? (
            <button type="button" className="idt-btn" onClick={() => setShown(n => n + STEP)}>
              Show more
            </button>
          ) : null}
          {cursor !== null ? (
            <button type="button" className="idt-btn" onClick={loadOlder} disabled={loading || posts === null}>
              <Icon name={loading ? 'refresh' : 'download'} /> {loading ? 'Loading…' : 'Load older from Instagram'}
            </button>
          ) : (
            <span className="idt-sub">That's every post on the account.</span>
          )}
        </div>
      </div>

      <div className="idt-dialog-foot">
        <span className="idt-sub" style={{ marginRight: 'auto' }}>
          {picked.size} selected
        </span>
        <button type="button" className="idt-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="idt-btn primary" onClick={save} disabled={saving || !changed}>
          <Icon name="check" />{' '}
          {saving
            ? 'Saving…'
            : picked.size
              ? `Link ${picked.size} post${picked.size === 1 ? '' : 's'}`
              : before.size
                ? 'Remove links'
                : 'Link posts'}
        </button>
      </div>
    </dialog>
  )
}

function Card({ p, on, words, onToggle }: { p: PickPost | LinkedPost; on: boolean; words: string[]; onToggle: () => void }) {
  const [broken, setBroken] = useState(false)
  const thumb = 'thumb' in p ? p.thumb : undefined
  const reach = 'reach' in p ? p.reach : undefined
  return (
    <button type="button" role="checkbox" aria-checked={on} className={`idt-post${on ? ' on' : ''}`} onClick={onToggle}>
      <span className="idt-post-img">
        {thumb && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <Icon name={/REEL|VIDEO/i.test(p.type) ? 'play' : 'camera'} />
        )}
        {on ? (
          <span className="idt-post-tick" aria-hidden="true">
            <Icon name="check" />
          </span>
        ) : null}
      </span>
      <span className="idt-post-meta">
        {day(p.timestamp)} · {kind(p.type)}
        {reach !== undefined ? ` · ${compact(reach)} reached` : ''}
      </span>
      <span className="idt-post-cap">
        <Highlight text={p.caption || '(no caption)'} words={words} />
      </span>
    </button>
  )
}
