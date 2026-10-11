'use client'
import { useState } from 'react'

// One tap copies a value: the collab email (Instagram's in-app browser often has no mail
// app to hand a mailto: link to) or an affiliate discount code. The value stays on screen
// either way, so a blocked clipboard still leaves it selectable.
export default function CopyText({ text, className = 'hl-copy', label }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      aria-label={`Copy ${label ?? text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch { /* clipboard blocked: the value is still on screen to select */ }
      }}
    >
      <span>{text}</span>
      <em aria-live="polite">{copied ? 'Copied' : 'Copy'}</em>
    </button>
  )
}
