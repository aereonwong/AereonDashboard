'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Icon from '@/app/_components/Icon'

// Takes a fresh snapshot through a refresh endpoint — Instagram's unless told otherwise.
export default function Refresh({
  label = 'Refresh from Instagram',
  endpoint = '/api/instagram/refresh',
}: {
  label?: string
  endpoint?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [, start] = useTransition()
  const run = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(endpoint, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.ok) {
        setMsg(`Updated · ${j.posts} posts${j.warnings?.length ? ` · not saved: ${j.warnings.join('; ')}` : ''}`)
        start(() => router.refresh())
      } else setMsg(j.error ?? 'That did not work — try again in a minute.')
    } catch {
      setMsg('Could not reach the server.')
    }
    setBusy(false)
  }
  return (
    <span data-edit="" style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="v3-btn" onClick={run} disabled={busy}>
        <Icon name="refresh" /> {busy ? 'Fetching… about a minute' : label}
      </button>
      {msg ? (
        <span className="v3-panel-note" role="status">
          {msg}
        </span>
      ) : null}
    </span>
  )
}
