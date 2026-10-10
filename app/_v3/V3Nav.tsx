'use client'

import { usePathname } from 'next/navigation'
import Icon, { type IconName } from '@/app/_components/Icon'

// v3's navigation. The v2 sidebar spread fourteen tabs over eight groups; for a
// one-person business v3 folds them into four, leading with the pages opened
// most. News sits under Social, beside Instagram.
export const V3_NAV: { title: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    title: 'Studio',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/invoices', label: 'Invoice Summary', icon: 'invoice' },
      { href: '/invoices/details', label: 'Invoice Details', icon: 'tasks' },
      { href: '/invoices/quotes', label: 'Quotations', icon: 'design' },
      { href: '/clients', label: 'Clients', icon: 'clients' },
    ],
  },
  {
    title: 'Social',
    items: [
      { href: '/instagram', label: 'Instagram', icon: 'instagram' },
      { href: '/news', label: 'News', icon: 'news' },
    ],
  },
  {
    title: 'Business',
    items: [
      { href: '/cash-in', label: 'Cash In', icon: 'cash-in' },
      { href: '/cash-out', label: 'Cash Out', icon: 'cash-out' },
      { href: '/leads', label: 'Leads', icon: 'leads' },
      { href: '/customers', label: 'Customers', icon: 'customers' },
      { href: '/content', label: 'Content', icon: 'content' },
      { href: '/tasks', label: 'Tasks', icon: 'tasks' },
    ],
  },
  {
    title: 'Property',
    items: [
      { href: '/property', label: 'Overview', icon: 'home' },
      { href: '/property/loans', label: 'Loans', icon: 'wallet' },
      { href: '/property/tenancy', label: 'Tenancy', icon: 'users' },
      { href: '/property/costs', label: 'Running costs', icon: 'cash-out' },
      { href: '/property/submeter', label: 'Sub-meter', icon: 'chart' },
    ],
  },
  {
    title: 'Robot',
    items: [
      { href: '/approvals', label: 'Approvals', icon: 'approvals' },
      { href: '/employees', label: 'AI Employees', icon: 'robot' },
      { href: '/vault', label: 'Vault', icon: 'vault' },
      { href: '/users', label: 'Users', icon: 'users' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

const HREFS = V3_NAV.flatMap(g => g.items.map(i => i.href))
// A tab is current on its own page and its sub-pages — unless a sub-page has a tab of its own.
const isCurrent = (path: string, href: string) =>
  path === href || (path.startsWith(`${href}/`) && !HREFS.some(h => h !== href && (path === h || path.startsWith(`${h}/`)) && h.length > href.length))

export function V3Nav({ pending }: { pending: number }) {
  const path = usePathname() ?? ''
  return (
    <nav className="v3-nav" aria-label="Main">
      {V3_NAV.map(group => (
        <div className="v3-nav-group" key={group.title}>
          <p className="v3-nav-title">{group.title}</p>
          {group.items.map(it => (
            <a key={it.href} href={it.href} aria-current={isCurrent(path, it.href) ? 'page' : undefined}>
              <Icon name={it.icon} />
              {it.label}
              {it.href === '/approvals' && pending > 0 ? <span className="v3-badge">{pending}</span> : null}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )
}

export function V3MobileBar() {
  const path = usePathname() ?? ''
  const items = V3_NAV.flatMap(g => g.items)
  return (
    <nav className="v3-mobilebar" aria-label="Main">
      {items.map(it => (
        <a key={it.href} href={it.href} aria-current={isCurrent(path, it.href) ? 'page' : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  )
}
