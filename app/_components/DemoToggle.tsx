'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// 👉 The demo-data switch, behind its own password. The cookie is written by the
// SERVER (/api/demo) after checking DEMO_PASSCODE, so nobody can flip demo mode
// on or off from the browser — including anyone you hand the app to mid-demo.
// Your real records are never touched either way; Instagram, the Telegram bot and
// the crons always use real data.
export default function DemoToggle({ initial }: { initial: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [asking, setAsking] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, enable: !on }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setError(body.message || 'That did not work.')
        return
      }
      setOn(!on)
      setAsking(false)
      setPasscode('')
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-edit="" className={`switchrow${on ? ' demo-flag' : ''}`}>
      <div style={{ flex: 1 }}>
        <p className="sr-t">Use demo data 🔒</p>
        <p className="sr-s">
          Fills every money, invoice, client, pipeline and task tab with an invented business, so you can
          explore or show the app without your real numbers. Your own records stay exactly as they are and
          come back the moment you switch this off. Instagram keeps showing your real account either way,
          and your Telegram bot always answers from the real data. Both directions need the demo password.
        </p>

        {asking ? (
          <form onSubmit={submit} className="demo-ask">
            <input
              className="login-input"
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Demo password"
              autoFocus
              autoComplete="off"
            />
            <button type="submit" className="btn" disabled={busy || !passcode}>
              {busy ? 'Checking…' : on ? 'Turn off' : 'Turn on'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setAsking(false)
                setPasscode('')
                setError(null)
              }}
            >
              Cancel
            </button>
          </form>
        ) : null}
        {error ? <p className="login-error">{error}</p> : null}
      </div>

      <button
        type="button"
        className={`switch${on ? ' on' : ''}`}
        onClick={() => {
          setError(null)
          setAsking(v => !v)
        }}
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Turn demo data off (password required)' : 'Turn demo data on (password required)'}
      >
        <span className="knob" />
      </button>
    </div>
  )
}
