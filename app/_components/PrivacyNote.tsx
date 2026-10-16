'use client'

import { usePathname } from 'next/navigation'
import { setShown } from './money-privacy'

// While amounts are hidden the server sends zeros (lib/privacy.ts), so anything worked
// out FROM amounts — charts, shares, rankings by value, "who grew" — is blank or flat
// too. This note says so at the top of the money pages, with the way back.
const MONEY_PAGES = ['/dashboard', '/invoices', '/clients', '/property', '/cash-in', '/cash-out', '/customers', '/leads']

export default function PrivacyNote({ shown }: { shown: boolean }) {
  const path = usePathname() ?? ''
  if (shown || !MONEY_PAGES.some(p => path === p || path.startsWith(p + '/'))) return null
  return (
    <div className="privacy-note" role="note">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.75" />
        <path d="M4 4l16 16" />
      </svg>
      <p>
        <b>Amounts are hidden.</b> They are not sent to this page, so figures, money charts and anything ranked by
        value stay blank until you show them.
      </p>
      <button type="button" className="privacy-note-btn" onClick={() => setShown(true)}>
        Show amounts
      </button>
    </div>
  )
}
