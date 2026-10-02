'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// 👉 "Refresh now" for the Instagram tab. Calls the server route, then reloads the
// page so the new snapshot shows. Any failure is shown in plain words, never swallowed.
export default function RefreshButton({ endpoint, label = 'Refresh now' }: { endpoint: string; label?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <div className="btnrow">
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              const res = await fetch(endpoint, { method: 'POST' })
              const body = await res.json().catch(() => ({}))
              if (!res.ok || !body.ok) setError(body.error || `Refresh failed (${res.status})`)
              else {
                // History rows that could not be saved are reported, not hidden.
                if (body.warnings?.length) setError(`Updated, but not saved: ${body.warnings.join('; ')}`)
                router.refresh()
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Refresh failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Fetching from Instagram…' : label}
        </button>
      </div>
      {error ? <p className="login-error">{error}</p> : null}
    </div>
  )
}
