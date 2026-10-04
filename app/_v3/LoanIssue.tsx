'use client'

import { useState, useTransition } from 'react'
import type { DataIssue } from '@/lib/property-math'
import { setIssueStatus } from '@/lib/property-actions'

// One open finding from the spreadsheet move: what the figure is now, what it should be, why.
export default function LoanIssue({ issue, range }: { issue: DataIssue; range: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const act = (status: 'fixed' | 'ignored') =>
    start(async () => {
      const r = await setIssueStatus(issue.id, status)
      setError(r.ok ? null : r.error)
    })
  return (
    <li className="v3-prop-issue" data-sev={issue.severity}>
      <div className="v3-prop-issue-top">
        <span className="v3-tag">{issue.severity}</span>
        <b>{range}</b>
        <span className="v3-panel-note">{issue.field}</span>
      </div>
      <div className="v3-prop-cmp">
        <div>
          <small>Now</small>
          <span className="num">{issue.current_value}</span>
        </div>
        <div>
          <small>Should be</small>
          <span className="num">{issue.suggested_value}</span>
        </div>
      </div>
      <p>{issue.explanation}</p>
      <div className="v3-prop-actions">
        <button className="v3-btn" type="button" disabled={pending} onClick={() => act('fixed')}>
          Mark fixed
        </button>
        <button className="v3-btn" type="button" disabled={pending} onClick={() => act('ignored')}>
          Ignore
        </button>
        {error ? <span className="v3-prop-msg">{error}</span> : null}
      </div>
    </li>
  )
}
