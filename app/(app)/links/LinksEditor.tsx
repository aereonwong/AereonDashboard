'use client'
import { useState, useTransition } from 'react'
import { saveHello } from '@/lib/hello-actions'
import { LIMITS, cleanUrl, type HelloConfig } from '@/lib/hello-config'
import ListEditor from './ListEditor'

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
  const addTopic = () => {
    const t = topic.trim().slice(0, LIMITS.topic)
    if (!t || cfg.topics.includes(t) || cfg.topics.length >= LIMITS.topics) return
    set('topics', [...cfg.topics, t])
    setTopic('')
  }
  const badLinks = [...cfg.links, ...cfg.affiliates].filter(l => l.label.trim() && l.url.trim() && !cleanUrl(l.url)).length

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

      <section className="v3-panel v3-span-12" aria-labelledby="lk-svc">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="lk-svc">Services</h2>
          <p className="v3-panel-note">The Photographer or Videographer and Drone Pilot sections. Their email buttons ask the right questions for each.</p>
        </div>
        <div className="lk-stack">
          <label className="v3-field lk-wide">
            <span>Photographer / Videographer intro</span>
            <input className="v3-input" maxLength={LIMITS.shootNote} value={cfg.shootNote} onChange={e => set('shootNote', e.target.value)} disabled={!dbReady} />
          </label>
          <label className="v3-field lk-wide">
            <span>Price on &ldquo;Visiting Kuala Lumpur&rdquo; (optional; blank hides it)</span>
            <input className="v3-input" maxLength={LIMITS.shootFrom} value={cfg.shootFrom} onChange={e => set('shootFrom', e.target.value)} disabled={!dbReady} />
          </label>
          <label className="v3-field lk-wide">
            <span>Drone pilot intro</span>
            <input className="v3-input" maxLength={LIMITS.droneNote} value={cfg.droneNote} onChange={e => set('droneNote', e.target.value)} disabled={!dbReady} />
          </label>
        </div>
      </section>

      <section className="v3-panel v3-span-12" aria-labelledby="lk-links">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="lk-links">Links</h2>
          <p className="v3-panel-note">Shown in the Brand collab section, in this order. Untick to hide without deleting.</p>
        </div>
        <ListEditor rows={cfg.links} onChange={v => set('links', v)} max={LIMITS.links} disabled={!dbReady} addLabel="Add a link" />
      </section>

      <section className="v3-panel v3-span-12" aria-labelledby="lk-aff">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="lk-aff">Affiliate links</h2>
          <p className="v3-panel-note">Pick a section for each: Attractions or Gear List. Marked as sponsored; a code shows with a copy button. A section stays hidden while it has no links.</p>
        </div>
        <div className="lk-stack" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="v3-field lk-wide">
            <span>Attractions heading</span>
            <input className="v3-input" maxLength={LIMITS.affiliateTitle} value={cfg.dealsTitle} onChange={e => set('dealsTitle', e.target.value)} disabled={!dbReady} />
          </label>
          <label className="v3-field lk-wide">
            <span>Gear heading</span>
            <input className="v3-input" maxLength={LIMITS.affiliateTitle} value={cfg.affiliateTitle} onChange={e => set('affiliateTitle', e.target.value)} disabled={!dbReady} />
          </label>
          <label className="v3-field lk-wide">
            <span>Disclosure line (optional; leave blank to hide)</span>
            <input className="v3-input" maxLength={LIMITS.affiliateNote} value={cfg.affiliateNote} onChange={e => set('affiliateNote', e.target.value)} disabled={!dbReady} />
          </label>
        </div>
        <ListEditor rows={cfg.affiliates} onChange={v => set('affiliates', v)} max={LIMITS.affiliates} withCode disabled={!dbReady} addLabel="Add an affiliate link" />
        {!cfg.affiliates.length ? <p className="v3-panel-note" style={{ marginTop: 'var(--space-3)' }}>None yet. The section stays hidden on the page until one is added.</p> : null}
        <p className="v3-panel-note" style={{ marginTop: 'var(--space-3)' }}>
          Links without a label or a valid address are dropped on save.
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
