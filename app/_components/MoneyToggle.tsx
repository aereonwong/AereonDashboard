'use client'

import { useState } from 'react'
import { setShown } from './money-privacy'

// The privacy switch. "row" sits in the v3 rail and the classic sidebar: eye,
// label and a switch, the way a banking app offers "Hide balances". "icon" is
// the phone version, pinned to the end of the v3 top bar.
// `shown` comes from the server (lib/privacy.ts), which drew this page with or without amounts.
export default function MoneyToggle({ shown, variant = 'row' }: { shown: boolean; variant?: 'row' | 'icon' }) {
  const [busy, setBusy] = useState(false)
  const label = shown ? 'Hide amounts' : 'Show amounts'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!shown}
      aria-label={variant === 'icon' ? label : undefined}
      title={shown ? 'Amounts are showing. They hide again after 5 minutes idle.' : 'Amounts are hidden. Show them all.'}
      className={`money-toggle money-toggle--${variant}`}
      data-shown={shown ? '' : undefined}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => {
        setBusy(true)
        setShown(!shown) // reloads: the server redraws the page with or without amounts
      }}
    >
      <Eye open={shown} />
      {variant === 'row' ? (
        <>
          <span className="money-toggle-text">
            <b>Hide amounts</b>
            <small>{shown ? 'Auto-hides in 5 min' : 'Tap a figure to show'}</small>
          </span>
          <span className="money-toggle-switch" aria-hidden="true" />
        </>
      ) : null}
    </button>
  )
}

function Eye({ open }: { open: boolean }) {
  return (
    <svg className="money-toggle-eye" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {open ? null : <path d="M4 4l16 16" />}
    </svg>
  )
}
