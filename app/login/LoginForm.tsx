'use client'
import { useState } from 'react'

const GOOGLE_ERRORS: Record<string, string> = {
  revoked: 'Your access was removed. Ask Aereon if that is a mistake.',
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
  const [going, setGoing] = useState(false)

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
        className="v3-input"
        type="password"
        inputMode="text"
        autoComplete="current-password"
        placeholder="Backup passcode"
        aria-label="Backup passcode"
        value={passcode}
        onChange={e => setPasscode(e.target.value)}
        autoFocus={!google}
      />
      <button className="lg-submit" type="submit" disabled={busy || !passcode}>
        {busy ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  )

  return (
    <>
      <div className="lg-brand">
        <span className="lg-mark" aria-hidden="true">A</span> Aereon Dashboard
      </div>
      <h1 className="lg-title">{google ? 'Sign in' : 'Enter your passcode'}</h1>
      <p className="lg-sub">{google ? 'Use the Google account you were approved with.' : 'Private numbers. Passcode only.'}</p>
      {google ? (
        <a className="lg-google" href="/api/auth/google" aria-busy={going} onClick={() => setGoing(true)}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          {going ? 'Opening Google…' : 'Continue with Google'}
        </a>
      ) : null}
      {error ? <p className="lg-error" role="alert">{error}</p> : null}
      {passcodeOn ? (
        google ? (
          <details className="lg-backup">
            <summary>Use backup passcode</summary>
            {passcodeForm}
          </details>
        ) : (
          passcodeForm
        )
      ) : null}
    </>
  )
}
