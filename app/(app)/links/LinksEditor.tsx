'use client'
import { useState, useTransition } from 'react'
import { saveHello } from '@/lib/hello-actions'
import { LIMITS, cleanUrl, type HelloConfig, type HelloLink } from '@/lib/hello-config'

const newId = () => `l${Date.now().toString(36)}`

export default function LinksEditor({ initial, dbReady, email, socials }: {
  initial: HelloConfig
  dbReady: boolean
  email: string
  socials: string[]
}) {
  const [cfg, setCfg] = useState(initial)
  const [saved, setSaved] = useState(JSON.stringify(initial))
  const [topic, setTopic] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const dirty = JSON.stringify(cfg) !== saved

  const set = <K extends keyof HelloConfig>(k: K, v: HelloConfig[K]) => { setCfg(c => ({ ...c, [k]: v })); setMsg(null) }
  const setLink = (i: number, patch: Partial<HelloLink>) => set('links', cfg.links.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= cfg.links.length) return
    const next = [...cfg.links]
    ;[next[i], next[j]] = [next[j], next[i]]
    set('links', next)
  }
  const addTopic = () => {
    const t = topic.trim().slice(0, LIMITS.topic)
    if (!t || cfg.topics.includes(t) || cfg.topics.length >= LIMITS.topics) return
    set('topics', [...cfg.topics, t])
    setTopic('')
  }
  const badLinks = cfg.links.filter(l => l.label.trim() && l.url.trim() && !cleanUrl(l.url)).length

  const save = () => start(async () => {
    const r = await saveHello(cfg)
    if (!r.ok) return setMsg({ ok: false, text: r.error })
    setCfg(r.config)
    setSaved(JSON.stringify(r.config))
    setMsg({ ok: true, text: 'Saved. The page is live.' })
  })

  return (
    <>
      <section className="v3-panel v3-span-12" aria-labelledby="lk-top">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="lk-top">Header</h2>
          <p className="v3-panel-note">Icons shown: {socials.join(', ')} (from the socials list)</p>
        </div>
        <label className="v3-field lk-wide">
          <span>Line under your name</span>
          <input className="v3-input" maxLength={LIMITS.tagline} value={cfg.tagline} onChange={e => set('tagline', e.target.value)} disabled={!dbReady} />
        </label>
      </section>

      <section className="v3-panel v3-span-12" aria-labelledby="lk-collab">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="lk-collab">Collab</h2>
          <p className="v3-panel-note">Every button opens an email to {email} with a ready brief</p>
        </div>
        <div className="lk-stack">
          <label className="v3-field lk-wide">
            <span>Heading</span>
            <input className="v3-input" maxLength={LIMITS.collabTitle} value={cfg.collabTitle} onChange={e => set('collabTitle', e.target.value)} disabled={!dbReady} />
          </label>
          <label className="v3-field lk-wide">
            <span>What brands can book</span>
            <input className="v3-input" maxLength={LIMITS.collabNote} value={cfg.collabNote} onChange={e => set('collabNote', e.target.value)} disabled={!dbReady} />
          </label>
          <div className="v3-field lk-wide">
            <span>Topic buttons (up to {LIMITS.topics}; each puts its name in the email subject)</span>
            <div className="lk-chips">
              {cfg.topics.map(t => (
                <button key={t} type="button" className="v3-chip lk-chip" onClick={() => set('topics', cfg.topics.filter(x => x !== t))} disabled={!dbReady} aria-label={`Remove ${t}`}>
                  {t} <span aria-hidden="true">×</span>
                </button>
              ))}
              {cfg.topics.length < LIMITS.topics ? (
                <form className="lk-chip-add" onSubmit={e => { e.preventDefault(); addTopic() }}>
                  <input className="v3-input" placeholder="Add a topic" maxLength={LIMITS.topic} value={topic} onChange={e => setTopic(e.target.value)} disabled={!dbReady} />
                  <button className="v3-btn" type="submit" disabled={!topic.trim() || !dbReady}>Add</button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="v3-panel v3-span-12" aria-labelledby="lk-links">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="lk-links">Links</h2>
          <p className="v3-panel-note">Shown in this order under the collab card. Untick to hide without deleting.</p>
        </div>
        <ol className="lk-list">
          {cfg.links.map((l, i) => (
            <li key={l.id} className={l.on ? '' : 'lk-off'}>
              <label className="lk-on" title={l.on ? 'Shown' : 'Hidden'}>
                <input type="checkbox" checked={l.on} onChange={e => setLink(i, { on: e.target.checked })} disabled={!dbReady} />
                <span className="sr-only">Show {l.label}</span>
              </label>
              <label className="v3-field"><span>Label</span>
                <input className="v3-input" maxLength={LIMITS.label} value={l.label} onChange={e => setLink(i, { label: e.target.value })} disabled={!dbReady} />
              </label>
              <label className="v3-field"><span>Link</span>
                <input className="v3-input" inputMode="url" placeholder="https://" maxLength={LIMITS.url} value={l.url}
                  aria-invalid={!!l.url.trim() && !cleanUrl(l.url)} onChange={e => setLink(i, { url: e.target.value })} disabled={!dbReady} />
              </label>
              <label className="v3-field"><span>Small note (optional)</span>
                <input className="v3-input" maxLength={LIMITS.note} value={l.note} onChange={e => setLink(i, { note: e.target.value })} disabled={!dbReady} />
              </label>
              <div className="lk-row-btns">
                <button type="button" className="v3-btn" onClick={() => move(i, -1)} disabled={i === 0 || !dbReady} aria-label={`Move ${l.label} up`}>↑</button>
                <button type="button" className="v3-btn" onClick={() => move(i, 1)} disabled={i === cfg.links.length - 1 || !dbReady} aria-label={`Move ${l.label} down`}>↓</button>
                <button type="button" className="v3-btn" onClick={() => set('links', cfg.links.filter((_, j) => j !== i))} disabled={!dbReady} aria-label={`Delete ${l.label}`}>Delete</button>
              </div>
            </li>
          ))}
        </ol>
        {cfg.links.length < LIMITS.links ? (
          <button type="button" className="v3-btn" style={{ marginTop: 'var(--space-3)' }} disabled={!dbReady}
            onClick={() => set('links', [...cfg.links, { id: newId(), label: '', url: '', note: '', on: true }])}>
            + Add a link
          </button>
        ) : null}
        <p className="v3-panel-note" style={{ marginTop: 'var(--space-3)' }}>
          Affiliate links get their own section later (gear, codes, click counts). Links without a label or a valid address are dropped on save.
        </p>
      </section>

      <div className="v3-span-12 lk-savebar">
        <button className="v3-btn v3-btn-primary" type="button" onClick={save} disabled={!dirty || pending || !dbReady}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <a className="v3-btn" href="/hello" target="_blank" rel="noopener">Open page</a>
        {badLinks ? <span className="v3-error" role="alert">{badLinks} link{badLinks > 1 ? 's have' : ' has'} an address that isn&apos;t a web link.</span> : null}
        {msg ? <span className={msg.ok ? 'lk-ok' : 'v3-error'} role="status">{msg.text}</span> : null}
        {!dbReady ? <span className="v3-error" role="alert">The database is not connected, so this can&apos;t be saved.</span> : null}
      </div>
    </>
  )
}
