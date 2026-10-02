import type { DailyPoint } from '@/lib/instagram'
import { compact, shortDate } from './fmt'

// 👉 Accounts reached each day, with follows gained beneath — the account's own
// daily line from Instagram, stored one day at a time in ig_account_daily, so it
// grows past the 30 days Instagram itself keeps. Hover a day for its figures.

export default function DailyReach({ days }: { days: DailyPoint[] }) {
  const shown = days.filter(d => d.reach !== undefined).slice(-90)
  if (shown.length < 2) return <p className="v3-empty">The daily line starts after the first account refresh.</p>
  const top = Math.max(...shown.map(d => d.reach ?? 0), 1)
  const topF = Math.max(...shown.map(d => d.new_followers ?? 0), 1)
  const peak = shown.reduce((m, d) => ((d.reach ?? 0) > (m.reach ?? 0) ? d : m), shown[0])
  const avg = shown.reduce((t, d) => t + (d.reach ?? 0), 0) / shown.length

  return (
    <figure className="v3-daily" aria-label={`Accounts reached per day, ${shortDate(shown[0].day)} to ${shortDate(shown.at(-1)!.day)}. Peak ${compact(peak.reach ?? 0)} on ${shortDate(peak.day)}.`}>
      <div className="v3-daily-plot">
        <span className="v3-daily-avg" style={{ ['--y' as string]: (avg / top).toFixed(3) }}>
          <span>avg {compact(avg)}</span>
        </span>
        {shown.map(d => (
          <span key={d.day} className="v3-daily-day" data-peak={d === peak || undefined} tabIndex={0}>
            <i className="v3-daily-bar" style={{ ['--h' as string]: ((d.reach ?? 0) / top).toFixed(3) }} />
            <i className="v3-daily-f" style={{ ['--h' as string]: ((d.new_followers ?? 0) / topF).toFixed(3) }} />
            <span className="v3-daily-tip" role="tooltip">
              <b>{shortDate(d.day)}</b>
              {compact(d.reach ?? 0)} reached
              {d.new_followers !== undefined ? <> · +{d.new_followers} followers</> : null}
            </span>
          </span>
        ))}
      </div>
      <figcaption className="v3-daily-axis">
        <span>{shortDate(shown[0].day)}</span>
        <span className="v3-daily-key">
          <i /> reach <i className="f" /> follows gained
        </span>
        <span>{shortDate(shown.at(-1)!.day)}</span>
      </figcaption>
    </figure>
  )
}
