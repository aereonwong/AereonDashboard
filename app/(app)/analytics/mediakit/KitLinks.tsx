'use client'
import { useRef, useState, useTransition } from 'react'
import { addKitLink, removeKitLink } from '@/lib/kit-links-actions'
import { kitUrl, type KitLink } from '@/lib/kit-links-config'
import type { TagStats } from '@/lib/kit-insights'

// 👉 Private share links for the media kit: type a brand, get aereonwong.com/mediakit?r=<random code>.
// The brand never appears in the link; this table is the only place that ties the two together.

type Row = KitLink & { stats: TagStats | null }

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="v3-btn" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }).catch(() => {})
    }}>{done ? 'Copied' : 'Copy link'}</button>
  )
}

export default function KitLinks({ rows, days }: { rows: Row[]; days: number }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const form = useRef<HTMLFormElement>(null)

  return (
    <div className="lk-stack">
      <form ref={form} className="kl-form" data-edit action={fd => start(async () => {
        setError('')
        const res = await addKitLink(fd)
        if (!res.ok) { setError(res.error); return }
        form.current?.reset()
      })}>
        <label className="v3-field v3-field-grow">Brand
          <input className="v3-input" name="brand" required maxLength={60} placeholder="e.g. Samsung Malaysia" autoComplete="off" />
        </label>
        <label className="v3-field v3-field-grow">Note (only you see it)
          <input className="v3-input" name="note" maxLength={120} placeholder="e.g. Q4 pitch to marketing team" autoComplete="off" />
        </label>
        <button className="v3-btn v3-btn-primary" disabled={pending}>{pending ? 'Making…' : 'Make link'}</button>
      </form>
      {error ? <p className="v3-panel-note" role="alert">{error}</p> : null}

      {rows.length ? (
        <div className="v3-table-wrap">
          <table className="lk-table kl-table">
            <thead>
              <tr><th>Brand</th><th>Link</th><th>Visitors</th><th>Reached Contact</th><th>Opened a post</th><th>PDF</th><th>Email</th><th><span className="v3-visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                  <tr key={r.code}>
                    <td><b>{r.brand}</b>{r.note ? <small className="kl-note">{r.note}</small> : null}<small className="kl-note">Made {r.created}</small></td>
                    <td><code className="lk-code">…/mediakit?r={r.code}</code></td>
                    <td>{r.stats?.visitors ?? 0}</td>
                    <td>{r.stats?.finished ?? 0}</td>
                    <td>{r.stats?.work ?? 0}</td>
                    <td>{r.stats?.pdf ?? 0}</td>
                    <td>{r.stats?.emailed ?? 0}</td>
                    <td className="kl-actions">
                      <Copy text={kitUrl(r.code)} />
                      <button type="button" className="v3-btn v3-btn-danger" data-edit disabled={pending} onClick={() => {
                        if (!confirm(`Remove the link for ${r.brand}? Visits already logged stay, but show only as a code.`)) return
                        start(async () => { const res = await removeKitLink(r.code); if (!res.ok) setError(res.error) })
                      }}>Remove</button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="v3-empty">No links yet. Type a brand above to make the first one.</p>}
      <p className="v3-panel-note">Counts cover the last {days} days. Each brand gets its own random code, so the link says nothing about who it was sent to.</p>
    </div>
  )
}
