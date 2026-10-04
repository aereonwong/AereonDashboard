import { actor } from '@/lib/auth'

// 👉 Settings → Account: who is signed in here, and the sign-out button. The only
// sign-out on a phone (the mobile bar has no room for one).
export default async function AccountPanel() {
  const { who, role } = await actor()
  if (!who) return null
  const label = who === 'pw' ? 'the backup passcode' : who
  return (
    <section className="v3-panel v3-span-12" aria-labelledby="t-acct">
      <div className="v3-panel-head">
        <h2 className="v3-panel-title" id="t-acct">Account</h2>
        <p className="v3-panel-note">{role ? role[0].toUpperCase() + role.slice(1) : 'Signed in'}</p>
      </div>
      <p className="v3-panel-note" style={{ marginBottom: 'var(--space-4)' }}>
        Signed in with <b style={{ color: 'var(--ink)', overflowWrap: 'anywhere' }}>{label}</b> on this device.
      </p>
      <form method="post" action="/api/logout" className="v3-row-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="v3-btn" type="submit">Sign out</button>
        {role === 'owner' || role === 'admin' ? <a className="v3-btn" href="/users">Manage users</a> : null}
      </form>
    </section>
  )
}
