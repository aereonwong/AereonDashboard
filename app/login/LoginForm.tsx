'use client'
import { useState } from 'react'

const GOOGLE_ERRORS: Record<string, string> = {
  not_allowed: "That Google account isn't on the list for this app.",
  google_failed: "Google sign-in didn't complete. Try again.",
  google_cancelled: 'Google sign-in was cancelled.',
  google_off: 'Google sign-in is not set up yet.',
}

// Google is the front door; the passcode is the backup, folded away. On success
// the server sets the session cookie and we send you to your HQ.
export default function LoginForm({ google, passcode: passcodeOn, initialError }: {
  google: boolean
  passcode: boolean
  initialError: string
}) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState(GOOGLE_ERRORS[initialError] ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) {
        window.location.href = '/dashboard'
        return
      }
      if (body.reason === 'too_many_attempts') {
        const mins = Math.max(1, Math.ceil((Number(body.retryAfter) || 900) / 60))
        setError(`Too many wrong tries. Locked for ${mins} minute${mins === 1 ? '' : 's'} — try again after that.`)
      } else if (body.reason === 'passcode_off') {
        setError('The backup passcode is switched off. Use Google.')
      } else if (body.reason === 'no_passcode_set') {
        setError("No passcode is set yet, so there's nothing to unlock — just open the app.")
      } else {
        setError("That code didn't match. Try again.")
      }
    } catch {
      setError('Something went wrong reaching the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const passcodeForm = (
    <form onSubmit={submit}>
      <input
        className="login-input"
        type="password"
        inputMode="text"
        autoComplete="current-password"
        placeholder="Backup passcode"
        value={passcode}
        onChange={e => setPasscode(e.target.value)}
        autoFocus={!google}
      />
      <button className="btn" type="submit" disabled={busy || !passcode} style={{ width: '100%', marginTop: 12 }}>
        {busy ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  )

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 8 }}>
          <span className="logo" aria-hidden="true">🤖</span> Aereon Dashboard
        </div>
        <h1 className="ph" style={{ fontSize: 18 }}>{google ? 'Sign in' : 'Enter your passcode'}</h1>
        <p className="cap" style={{ margin: '4px 0 16px' }}>
          Private numbers. Only approved accounts get in.
        </p>
        {google ? (
          <a className="btn" href="/api/auth/google" style={{ display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
            Continue with Google
          </a>
        ) : null}
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        {passcodeOn ? (
          google ? (
            <details style={{ marginTop: 16 }}>
              <summary className="cap" style={{ cursor: 'pointer' }}>Use backup passcode</summary>
              <div style={{ marginTop: 10 }}>{passcodeForm}</div>
            </details>
          ) : (
            passcodeForm
          )
        ) : null}
      </div>
    </div>
  )
}
