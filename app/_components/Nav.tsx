'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon, { type IconName } from './Icon'

// 👉 The desktop sidebar tabs, grouped under micro-cap section labels.
//    Adding a tab? Add ONE line to the right group here, add the SAME tab to
//    BottomNav.tsx (bottom bar or the More sheet, so it shows on phones too),
//    and create app/(app)/<name>/page.tsx.
//    See docs/add-a-tab-prompt.md for the copy-paste prompt that does all three.
export const NAV_GROUPS: { label: string; tabs: { href: string; label: string; icon: IconName }[] }[] = [
  { label: 'Overview', tabs: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  ] },
  { label: 'Invoice', tabs: [
    { href: '/invoices', label: 'Invoice Summary', icon: 'invoice' },
    { href: '/invoices/details', label: 'Invoice Details', icon: 'tasks' },
    { href: '/clients', label: 'Clients', icon: 'clients' },
  ] },
  { label: 'Social', tabs: [
    { href: '/instagram', label: 'Instagram', icon: 'instagram' },
    { href: '/news', label: 'News', icon: 'news' },
  ] },
  { label: 'Money', tabs: [
    { href: '/cash-in', label: 'Cash In', icon: 'cash-in' },
    { href: '/cash-out', label: 'Cash Out', icon: 'cash-out' },
  ] },
  { label: 'Pipeline', tabs: [
    { href: '/leads', label: 'Leads', icon: 'leads' },
    { href: '/customers', label: 'Customers', icon: 'customers' },
  ] },
  { label: 'Work', tabs: [
    { href: '/content', label: 'Content', icon: 'content' },
    { href: '/tasks', label: 'Tasks', icon: 'tasks' },
  ] },
  { label: 'Robot', tabs: [
    { href: '/approvals', label: 'Approvals', icon: 'approvals' },
    { href: '/employees', label: 'AI Employees', icon: 'robot' },
    { href: '/vault', label: 'Vault', icon: 'vault' },
  ] },
  { label: 'You', tabs: [
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ] },
]

// Flat list kept for anything that wants every tab in one array.
export const TABS = NAV_GROUPS.flatMap(g => g.tabs)

// `pendingCount` is an optional seam: pass it (from a server component that
// already knows the number) to show the 🙋 badge on Approvals. We never fetch
// here — a client nav must stay free of its own server round-trips.
export default function Nav({ pendingCount }: { pendingCount?: number }) {
  const path = usePathname()
  return (
    <nav className="nav">
      {NAV_GROUPS.map(group => (
        <div className="nav-group" key={group.label}>
          <p className="nav-label">{group.label}</p>
          {group.tabs.map(t => (
            <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''}>
              <Icon name={t.icon} />
              <span className="lbl">{t.label}</span>
              {t.href === '/approvals' && pendingCount ? (
                <span className="nav-badge" aria-label={`${pendingCount} pending`}>{pendingCount}</span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
