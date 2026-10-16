import Nav from '@/app/_components/Nav'
import BottomNav from '@/app/_components/BottomNav'
import ConnStatus from '@/app/_components/ConnStatus'
import ThemeToggle from '@/app/_components/ThemeToggle'
import { getPendingCount, demoMode } from '@/lib/records'
import { readVersion } from '@/lib/v3/version'
import V3Shell from '@/app/_v3/Shell'
import MoneyMask from '@/app/_components/MoneyMask'
import MoneyToggle from '@/app/_components/MoneyToggle'
import { redirect } from 'next/navigation'
import { canEdit, signedIn, sessionUser } from '@/lib/auth'
import { canRevealMoney, moneyHidden } from '@/lib/privacy'

// The dashboard chrome: sidebar on desktop, bottom bar on phones. Everything
// inside app/(app)/ gets it; the landing page and /login do not.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Locked or removed in Users? Out they go (the cookie alone is still valid).
  if (!(await signedIn())) redirect('/login?error=revoked')
  const [pending, demo, { version }, who, editor, hidden] = await Promise.all([getPendingCount(), demoMode(), readVersion(), sessionUser(), canEdit(), moneyHidden()])
  const owner = await canRevealMoney()
  // v3 is a whole-app version with its own chrome; v1 and v2 share the classic one.
  if (version === 'v3') {
    return (
      <>
        <V3Shell pending={pending} demo={demo} who={who} viewOnly={!editor} amountsShown={!hidden} canReveal={owner}>
          {children}
        </V3Shell>
        <MoneyMask shown={!hidden} canReveal={owner} />
      </>
    )
  }
  return (
    <>
      <div className="app">
        <aside className="side">
          <a className="brand" href="/">
            <span className="logo" aria-hidden="true">A</span> Aereon Dashboard
          </a>
          <MoneyToggle shown={!hidden} canReveal={owner} />
          <Nav pendingCount={pending} />
          <p className="hint">
            Tech &amp; travel creator HQ — invoices, clients, Instagram and your AI agents.
          </p>
          <ThemeToggle />
          {who ? (
            <form method="post" action="/api/logout" style={{ marginTop: 12, fontSize: 12 }}>
              <p className="hint" style={{ margin: '0 0 4px', overflowWrap: 'anywhere' }}>{who === 'pw' ? 'Signed in with passcode' : who}</p>
              <button className="btn" type="submit">Sign out</button>
            </form>
          ) : null}
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
      <MoneyMask shown={!hidden} canReveal={owner} />
    </>
  )
}
