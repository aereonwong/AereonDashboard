import Nav from '@/app/_components/Nav'
import BottomNav from '@/app/_components/BottomNav'
import ConnStatus from '@/app/_components/ConnStatus'
import ThemeToggle from '@/app/_components/ThemeToggle'
import { getPendingCount, demoMode } from '@/lib/records'
import { readVersion } from '@/lib/v3/version'
import V3Shell from '@/app/_v3/Shell'

// The dashboard chrome: sidebar on desktop, bottom bar on phones. Everything
// inside app/(app)/ gets it; the landing page and /login do not.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [pending, demo, { version }] = await Promise.all([getPendingCount(), demoMode(), readVersion()])
  // v3 is a whole-app version with its own chrome; v1 and v2 share the classic one.
  if (version === 'v3') {
    return (
      <V3Shell pending={pending} demo={demo}>
        {children}
      </V3Shell>
    )
  }
  return (
    <>
      <div className="app">
        <aside className="side">
          <a className="brand" href="/">
            <span className="logo" aria-hidden="true">A</span> Aereon Dashboard
          </a>
          <Nav pendingCount={pending} />
          <p className="hint">
            Tech &amp; travel creator HQ — invoices, clients, Instagram and your AI agents.
          </p>
          <ThemeToggle />
        </aside>
        <main className="main">
          <ConnStatus />
          {demo ? (
            <div className="banner warn">
              <b>Demo data is on.</b> Every money, invoice, client and pipeline tab is showing an invented
              business. Your real records are untouched — turn it off in <a href="/settings">Settings</a>.
              Instagram and your Telegram bot still use real data.
            </div>
          ) : null}
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  )
}
