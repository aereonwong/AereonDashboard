import Icon from '@/app/_components/Icon'
import type { DetailRow } from '@/lib/invoice-details'
import { statusFigures } from '@/lib/invoice-details'
import './invoices.css'

// 👉 The one status row on Invoice Summary: where the money stands and how much
// is filed in Google Drive. Each figure links to Invoice Details already
// filtered to the invoices behind it — the summary never lists them itself.

const rm = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`

export default function StatusStrip({ rows, year }: { rows: DetailRow[]; year?: string }) {
  const s = statusFigures(rows)
  const q = (extra: string) => `/invoices/details?${year ? `year=${year}&` : 'year=&'}${extra}`
  const tracked = s.count - s.untrackedCount

  return (
    <section className="idt idt-strip" aria-labelledby="idt-strip-title">
      <div className="idt-strip-head">
        <h2 id="idt-strip-title">Payment &amp; filing</h2>
        <a href={year ? `/invoices/details?year=${year}` : '/invoices/details?year='}>Every invoice in Invoice Details →</a>
      </div>
      <div className="idt-figs">
        <a className="idt-fig" href={q('payment=owed')}>
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-warn)' }} /> Outstanding
          </div>
          <div className="idt-fig-value">{rm(s.outstandingRM)}</div>
          <div className="idt-fig-note">
            {s.outstandingCount} unpaid invoice{s.outstandingCount === 1 ? '' : 's'}
          </div>
        </a>
        <a className={`idt-fig${s.overdueCount ? ' neg' : ''}`} href={q('payment=overdue')}>
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-neg)' }} /> Overdue
          </div>
          <div className="idt-fig-value">{s.overdueCount}</div>
          <div className="idt-fig-note">{s.overdueCount ? rm(s.overdueRM) : 'none past due'}</div>
        </a>
        <a className="idt-fig" href={q('payment=paid')}>
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-pos)' }} /> Paid
          </div>
          <div className="idt-fig-value">{rm(s.paidRM)}</div>
          <div className="idt-fig-note">
            {s.paidCount} invoice{s.paidCount === 1 ? '' : 's'}
          </div>
        </a>
        <a className="idt-fig" href={q('payment=untracked')}>
          <div className="idt-fig-label">Payment not tracked</div>
          <div className="idt-fig-value">{s.untrackedCount}</div>
          <div className="idt-fig-note">{tracked} of {s.count} tracked</div>
        </a>
        <a className="idt-fig" href={q('drive=uploaded')}>
          <div className="idt-fig-label">
            <Icon name="drive" /> In Google Drive
          </div>
          <div className="idt-fig-value">
            {s.driveUploaded} / {s.count}
          </div>
          <div className="idt-meter" aria-hidden="true">
            <i style={{ width: `${s.count ? (s.driveUploaded / s.count) * 100 : 0}%` }} />
          </div>
        </a>
        <a className="idt-fig" href={q('drive=pending')}>
          <div className="idt-fig-label">
            <Icon name="upload" /> Waiting for Drive
          </div>
          <div className="idt-fig-value">{s.drivePending}</div>
          <div className="idt-fig-note">{s.drivePending ? 'upload from Details' : 'all filed'}</div>
        </a>
      </div>
    </section>
  )
}
