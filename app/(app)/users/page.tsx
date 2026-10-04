// 👉 Users — who can sign in with Google, and as what. Owner and admins only.
import { actor } from '@/lib/auth'
import { listUsers } from '@/lib/access'
import { readVersion } from '@/lib/v3/version'
import { supabaseConfigured } from '@/lib/supabase'
import UsersPanel, { type ShownUser } from './UsersPanel'
import '@/app/_v3/v3.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(iso))
    : null

export default async function Users() {
  const [{ who, role }, { version }] = await Promise.all([actor(), readVersion()])
  const body =
    role !== 'owner' && role !== 'admin' ? (
      <section className="v3-panel v3-span-12">
        <p className="v3-empty">Only admins can manage users.</p>
      </section>
    ) : (
      <UsersPanel
        me={who}
        role={role}
        dbReady={supabaseConfigured}
        users={(await listUsers()).map<ShownUser>(u => ({ ...u, last: when(u.last_login_at) }))}
      />
    )
  const page = (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Users</h1>
          <p className="v3-lede">
            Who can sign in with Google. Locking or removing someone cuts them off on their next click. The backup
            passcode and the addresses in ADMIN_EMAILS always work.
          </p>
        </div>
      </header>
      <div className="v3-grid">{body}</div>
    </div>
  )
  // v3 pages sit inside the v3 shell; v1/v2 get the same look in a wrapper.
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
