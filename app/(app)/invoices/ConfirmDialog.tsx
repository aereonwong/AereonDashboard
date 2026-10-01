'use client'

import { useEffect, useRef } from 'react'
import Icon from '@/app/_components/Icon'

// 👉 The "are you sure?" step for invoice actions that change Canva or Drive.
// An in-page dialog rather than window.confirm(): some browsers (the Claude
// app's own browser pane among them) block native pop-ups and silently answer
// "no", which made the button look dead.

export type ConfirmAsk = {
  title: string
  lines: string[]
  /** Shown highlighted under the lines, e.g. "this invoice is marked paid". */
  warning?: string
  confirmLabel: string
  onConfirm: () => void
}

export default function ConfirmDialog({ ask, onCancel }: { ask: ConfirmAsk; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="idt-dialog idt idt-confirm"
      aria-labelledby="idt-confirm-title"
      onCancel={e => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="idt-dialog-head">
        <h2 id="idt-confirm-title">{ask.title}</h2>
      </div>
      <div className="idt-dialog-body">
        <ul>
          {ask.lines.map(l => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {ask.warning ? (
          <p className="idt-error idt-warn" role="note">
            <Icon name="alert" /> {ask.warning}
          </p>
        ) : null}
      </div>
      <div className="idt-dialog-foot">
        <button type="button" className="idt-btn" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" className="idt-btn primary" onClick={ask.onConfirm}>
          <Icon name="check" /> {ask.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
