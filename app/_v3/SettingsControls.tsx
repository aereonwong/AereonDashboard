'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { VERSIONS, type Version } from '@/lib/v3/catalog'
import { saveSite } from '@/lib/v3/site-actions'
import type { Landing, KitVersion } from '@/lib/v3/site'

// The v3 Settings controls. The version is per device (a cookie the server reads
// before drawing); the landing page is site-wide (stored on the server).

const setCookie = (k: string, v: string) => (document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`)

export function VersionPicker({ version }: { version: Version }) {
  const router = useRouter()
  const [v, setV] = useState(version)
  const [pending, start] = useTransition()
  return (
    <>
      <div className="v3-choice-grid" role="radiogroup" aria-label="App version">
        {VERSIONS.map(x => (
          <button
            key={x.id}
            type="button"
            className="v3-choice"
            role="radio"
            aria-checked={v === x.id}
            aria-pressed={v === x.id}
            disabled={pending}
            onClick={() => {
              setV(x.id)
              setCookie('cfo-dash', x.id)
              start(() => router.refresh())
            }}
          >
            <span className="v3-choice-top">
              <span className="v3-choice-name">
                {x.id} · {x.name}
              </span>
              <span className="v3-choice-date">{x.date}</span>
            </span>
            <span className="v3-choice-note">{x.note}</span>
          </button>
        ))}
      </div>

    </>
  )
}

export function Theme() {
  const [mode, setMode] = useState<'auto' | 'light' | 'dark'>('auto')
  useEffect(() => {
    try {
      const m = localStorage.getItem('cfo-theme')
      if (m === 'light' || m === 'dark') setMode(m)
    } catch {}
  }, [])
  const pick = (m: 'auto' | 'light' | 'dark') => {
    setMode(m)
    try {
      if (m === 'auto') localStorage.removeItem('cfo-theme')
      else localStorage.setItem('cfo-theme', m)
    } catch {}
    if (m === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', m)
  }
  return (
    <div className="v3-seg" role="group" aria-label="Light or dark">
      {(['auto', 'light', 'dark'] as const).map(m => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => pick(m)}>
          {m === 'auto' ? 'Match my device' : m === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  )
}

export function LandingSwitch({ landing, kit }: { landing: Landing; kit: KitVersion }) {
  const router = useRouter()
  const [l, setL] = useState(landing)
  const [k, setK] = useState(kit)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const save = (patch: { landing?: Landing; kit?: KitVersion }) =>
    start(async () => {
      const r = await saveSite(patch)
      setMsg(r.ok ? 'Saved — visitors see this now.' : r.error ?? 'Did not save.')
      router.refresh()
    })
  return (
    <>
      <div className="v3-choice-grid" role="radiogroup" aria-label="Public landing page">
        {(
          [
            ['classic', 'Front door', 'The current landing page: a simple entrance to the app.'],
            ['kit', 'Creator media kit', 'A public page that sells you to brands: who you are, your reach, your best work and how to book you.'],
          ] as [Landing, string, string][]
        ).map(([id, name, note]) => (
          <button
            key={id}
            type="button"
            className="v3-choice"
            role="radio"
            aria-checked={l === id}
            aria-pressed={l === id}
            disabled={pending}
            onClick={() => {
              setL(id)
              save({ landing: id })
            }}
          >
            <span className="v3-choice-name">{name}</span>
            <span className="v3-choice-note">{note}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
        <a className="v3-btn" href="/?preview=kit&kit=v1" target="_blank" rel="noreferrer">
          Preview kit v1
        </a>
        <a className="v3-btn" href="/?preview=kit&kit=v2" target="_blank" rel="noreferrer">
          Preview kit v2
        </a>
        <span className="v3-panel-note">Only you see a preview; visitors see whichever option is chosen above.</span>
      </div>
      {l === 'kit' ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
          <span className="v3-panel-note">Media kit version</span>
          <div className="v3-seg" role="group" aria-label="Media kit version">
            {(
              [
                ['v1', 'v1 · 26 Sep'],
                ['v2', 'v2 · 2 Oct, with audience'],
              ] as [KitVersion, string][]
            ).map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={k === id}
                disabled={pending}
                onClick={() => {
                  setK(id)
                  save({ kit: id })
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {msg ? (
        <p className="v3-panel-note" role="status" style={{ marginTop: 'var(--space-3)' }}>
          {msg}
        </p>
      ) : null}
    </>
  )
}
