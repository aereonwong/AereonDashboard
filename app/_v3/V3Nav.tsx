'use client'

import { usePathname } from 'next/navigation'
import Icon, { type IconName } from '@/app/_components/Icon'
import MoneyToggle from '@/app/_components/MoneyToggle'

// v3's navigation. The v2 sidebar spread fourteen tabs over eight groups; for a
// one-person business v3 folds them into four, leading with the pages opened
// most. News sits under Social, beside Instagram; Social opens on Overview (/social), both platforms together.
// The classic Business tabs (Cash In/Out, Leads, Customers, Content, Tasks) sit folded at the
// bottom since 12 Oct 2026: four were empty and the other two repeat Invoice Details and
// Clients. Still one click away, and every route still works.
type NavGroup = { title: string; folded?: boolean; items: { href: string; label: string; icon: IconName }[] }
export const V3_NAV: NavGroup[] = [
  {
    title: 'Studio',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/invoices', label: 'Invoice Summary', icon: 'invoice' },
      { href: '/invoices/details', label: 'Invoice Details', icon: 'tasks' },
      { href: '/invoices/quotes', label: 'Quotations', icon: 'design' },
      { href: '/clients', label: 'Clients', icon: 'clients' },
      { href: '/voice', label: 'Voice-over', icon: 'mic' },
    ],
  },
  {
    title: 'Social',
    items: [
      { href: '/social', label: 'Overview', icon: 'chart' },
      { href: '/instagram', label: 'Instagram', icon: 'instagram' },
      { href: '/facebook', label: 'Facebook', icon: 'facebook' },
      { href: '/tiktok', label: 'TikTok', icon: 'tiktok' },
      { href: '/news', label: 'News', icon: 'news' },
      { href: '/links', label: 'Link page', icon: 'share' },
      { href: '/mediakit', label: 'Media kit', icon: 'design' },
    ],
  },
  {
    title: 'Site analytics',
    items: [
      { href: '/analytics/landing', label: 'Landing page', icon: 'chart' },
      { href: '/analytics/link', label: 'Link page', icon: 'share' },
      { href: '/analytics/mediakit', label: 'Media kit', icon: 'design' },
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
    title: 'Classic tabs',
    folded: true,
    items: [
      { href: '/cash-in', label: 'Cash In', icon: 'cash-in' },
      { href: '/cash-out', label: 'Cash Out', icon: 'cash-out' },
      { href: '/leads', label: 'Leads', icon: 'leads' },
      { href: '/customers', label: 'Customers', icon: 'customers' },
      { href: '/content', label: 'Content', icon: 'content' },
      { href: '/tasks', label: 'Tasks', icon: 'tasks' },
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
      {V3_NAV.map(group => {
        const links = group.items.map(it => (
          <a key={it.href} href={it.href} aria-current={isCurrent(path, it.href) ? 'page' : undefined}>
            <Icon name={it.icon} />
            {it.label}
            {it.href === '/approvals' && pending > 0 ? <span className="v3-badge">{pending}</span> : null}
          </a>
        ))
        return group.folded ? (
          <details className="v3-nav-group v3-nav-fold" key={group.title} open={group.items.some(it => isCurrent(path, it.href))}>
            <summary className="v3-nav-title">{group.title}</summary>
            {links}
          </details>
        ) : (
          <div className="v3-nav-group" key={group.title}>
            <p className="v3-nav-title">{group.title}</p>
            {links}
          </div>
        )
      })}
    </nav>
  )
}

export function V3MobileBar({ amountsShown, canReveal }: { amountsShown: boolean; canReveal: boolean }) {
  const path = usePathname() ?? ''
  const items = V3_NAV.filter(g => !g.folded).flatMap(g => g.items)
  return (
    <nav className="v3-mobilebar" aria-label="Main">
      {items.map(it => (
        <a key={it.href} href={it.href} aria-current={isCurrent(path, it.href) ? 'page' : undefined}>
          {it.label}
        </a>
      ))}
      <MoneyToggle shown={amountsShown} canReveal={canReveal} variant="icon" />
    </nav>
  )
}
