'use client'
import { useState } from 'react'

// Instagram's in-app browser often has no mail app to hand a mailto: link to, so the
// address is always shown and one tap copies it.
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="hl-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch { /* clipboard blocked: the address is still on screen to select */ }
      }}
    >
      <span>{email}</span>
      <em aria-live="polite">{copied ? 'Copied' : 'Copy'}</em>
    </button>
  )
}
