'use client'

import { useState } from 'react'
import { setShown } from './money-privacy'

// The privacy switch, labelled with what turning it ON does — the platform convention
// (iOS Settings, banking apps): "Show amounts", off and grey by default, green when on.
// "row" sits in the v3 rail and the classic sidebar; "icon" is the phone version, pinned
// to the end of the v3 top bar. `shown` comes from the server (lib/privacy.ts), which
// drew this page with real or disguised amounts. Only the owner may switch it on
// (`canReveal`); for anyone else it is shown off and locked.
export default function MoneyToggle({ shown, canReveal, variant = 'row' }: { shown: boolean; canReveal: boolean; variant?: 'row' | 'icon' }) {
  const [busy, setBusy] = useState(false)
  const hint = !canReveal ? 'Owner only' : shown ? 'Hides after 30 min' : 'Off · tap any figure'
  const title = !canReveal
    ? 'Only the owner can show amounts.'
    : shown
      ? 'Amounts are showing. They hide again after 30 minutes idle.'
      : 'Amounts are hidden. Switch on to show them.'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-label={variant === 'icon' ? 'Show amounts' : undefined}
      title={title}
      className={`money-toggle money-toggle--${variant}`}
      data-shown={shown ? '' : undefined}
      data-locked={canReveal ? undefined : ''}
      aria-busy={busy || undefined}
      disabled={busy || !canReveal}
      onClick={() => {
        setBusy(true)
        setShown(!shown) // reloads: the server redraws the page with real or disguised amounts
      }}
    >
      {canReveal ? <Eye open={shown} /> : <Lock />}
      {variant === 'row' ? (
        <>
          <span className="money-toggle-text">
            <b>Show amounts</b>
            <small>{hint}</small>
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

function Lock() {
  return (
    <svg className="money-toggle-eye" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  )
}
