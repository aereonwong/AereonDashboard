// 👉 One tiny inline-SVG icon set — no icon library, no extra download.
// Each icon is a 24×24 stroked path that inherits the current text colour, so it
// follows whatever palette is active.
export type IconName =
  | 'dashboard' | 'cash-in' | 'cash-out' | 'leads' | 'customers' | 'invoice' | 'clients'
  | 'instagram' | 'content' | 'tasks' | 'approvals' | 'robot' | 'vault' | 'settings'
  | 'chart' | 'calendar' | 'trend' | 'eye' | 'heart' | 'share' | 'bookmark' | 'sparkle'
  | 'clock' | 'users' | 'pie' | 'refresh' | 'camera' | 'wallet'
  | 'news' | 'play' | 'filter' | 'close' | 'check' | 'search' | 'external' | 'chevron'
  | 'drive' | 'upload' | 'download' | 'design' | 'plus' | 'alert' | 'undo' | 'edit'

const P: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  'cash-in': <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /><rect x="3" y="19" width="18" height="2" rx="1" /></>,
  'cash-out': <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /><rect x="3" y="3" width="18" height="2" rx="1" /></>,
  leads: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
  customers: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16.5 8.5a3 3 0 1 0-1-5.8" /><path d="M18 20c0-2.6-1-4.3-2.6-5.2" /></>,
  invoice: <><path d="M6 3h9l4 4v14l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L4 21V5a2 2 0 0 1 2-2Z" /><path d="M8.5 9h7M8.5 13h5" /></>,
  clients: <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8.5 7V5.5A2.5 2.5 0 0 1 11 3h2a2.5 2.5 0 0 1 2.5 2.5V7" /><path d="M3 12h18" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  content: <><path d="M4 5h16v11H7l-3 3V5Z" /><path d="M8 9h8M8 12.5h5" /></>,
  tasks: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></>,
  approvals: <><path d="M12 3a4 4 0 0 1 4 4v3l2 4H6l2-4V7a4 4 0 0 1 4-4Z" /><path d="M10 18a2 2 0 1 0 4 0" /></>,
  robot: <><rect x="4" y="8" width="16" height="12" rx="4" /><path d="M12 4v4M9 14h.01M15 14h.01" /><path d="M9.5 17.5h5" /></>,
  vault: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="12" cy="12" r="3.5" /><path d="M12 8.5V6M12 18v-2.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.3-3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 3 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  chart: <><rect x="4" y="11" width="4" height="9" rx="1" /><rect x="10" y="6" width="4" height="14" rx="1" /><rect x="16" y="14" width="4" height="6" rx="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  trend: <><path d="m3 16 5.5-5.5 3.5 3.5L21 5" /><path d="M15 5h6v6" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  heart: <><path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.7 12 20 12 20Z" /></>,
  share: <><path d="m22 3-9.5 9.5" /><path d="M22 3 15 21l-3-7.5L4.5 10 22 3Z" /></>,
  bookmark: <><path d="M6 4h12v17l-6-4.2L6 21V4Z" /></>,
  sparkle: <><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.8L12 18l-1.7-5.5L4.8 10.7 10.3 9 12 3.5Z" /><path d="M19 4.5v3M17.5 6h3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  users: <><circle cx="8.5" cy="9" r="3" /><path d="M2.5 19c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.2c2.8.2 5 2 5 4.8" /></>,
  pie: <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M14.5 3.4A9 9 0 0 1 20.6 9.5h-6.1V3.4Z" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.5h-4.5" /></>,
  camera: <><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="12" cy="13.5" r="3.6" /><path d="M8.5 7 10 4.5h4L15.5 7" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.3" /></>,
  news: <><path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 0 2 0V9" /><path d="M5 4v15a2 2 0 0 0 2 2h13" /><path d="M8.5 8.5h6M8.5 12h6M8.5 15.5h3.5" /></>,
  play: <><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></>,
  filter: <><path d="M4 5h16l-6.2 7.3V19l-3.6-1.8v-4.9L4 5Z" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
  drive: <><path d="M8.5 3.5h7l6 10.5-3.5 6h-12L2.5 14l6-10.5Z" /><path d="m8.5 3.5 6 10.5h7M15.5 3.5l-9.5 16.5M2.5 14h12" /></>,
  upload: <><path d="M7 17.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8" /><path d="M12 20v-8M8.8 14.8 12 11.6l3.2 3.2" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  design: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M15.5 9.2a4 4 0 1 0 0 5.6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  alert: <><path d="M12 4 21 19.5H3L12 4Z" /><path d="M12 10v4.2M12 17h.01" /></>,
  undo: <><path d="M9 14 4.5 9.5 9 5" /><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
}

export default function Icon({ name, className = 'ico-svg' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {P[name]}
    </svg>
  )
}
