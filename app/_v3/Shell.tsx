import './v3.css'
import { v3Fonts } from './fonts'
import { V3Nav, V3MobileBar } from './V3Nav'

// The v3 chrome: its own backdrop, rail and mobile bar, wrapping whatever page
// is open. Pages outside v3's six keep their v2 content, drawn inside this frame.
export default function Shell({
  pending,
  demo,
  who,
  children,
}: {
  pending: number
  demo: boolean
  who: string | null
  children: React.ReactNode
}) {
  return (
    <div className={`v3 ${v3Fonts}`} data-world="canon">
      <div className="v3-backdrop" aria-hidden="true" />
      <V3MobileBar />
      <div className="v3-app">
        <aside className="v3-rail">
          <a className="v3-brand" href="/">
            <span className="v3-brand-mark" aria-hidden="true">A</span>
            <span className="v3-brand-name">
              Aereon Studio
              <span className="v3-brand-sub">v3 · Studio Standard</span>
            </span>
          </a>
          <V3Nav pending={pending} />
          <div className="v3-rail-foot">
            <a href="/settings">Switch version</a>
            {who ? (
              <form className="v3-signout" method="post" action="/api/logout">
                <span className="who">{who === 'pw' ? 'Signed in with passcode' : who}</span>
                <button type="submit">Sign out</button>
              </form>
            ) : null}
          </div>
        </aside>
        <main className="v3-main">
          {demo ? (
            <p className="v3-empty" role="status">
              <b>Demo data is on.</b> Money, invoice and client pages are showing an invented business. Turn it
              off in <a href="/settings">Settings</a>.
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
