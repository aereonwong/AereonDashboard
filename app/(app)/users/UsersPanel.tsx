'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addUser, setRole, setActive, removeUser } from './actions'
import type { AccessRole, UserRow } from '@/lib/access'

export type ShownUser = UserRow & { last: string | null }

const ROLE_NOTE: Record<AccessRole, string> = {
  owner: 'Everything, including other admins',
  admin: 'Everything, and manages viewers',
  viewer: 'Sees the app, manages no one',
}

export default function UsersPanel({ users, me, role, dbReady }: {
  users: ShownUser[]
  me: string | null
  role: AccessRole
  dbReady: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<AccessRole>('viewer')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const isOwner = role === 'owner'
  const roles: AccessRole[] = isOwner ? ['viewer', 'admin', 'owner'] : ['viewer']

  const run = (job: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: () => void) =>
    start(async () => {
      setError('')
      const r = await job()
      if (!r.ok) setError(r.error)
      else {
        done?.()
        router.refresh()
      }
    })

  return (
    <>
      <section className="v3-panel v3-span-12" aria-labelledby="u-add">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="u-add">Add a person</h2>
          <p className="v3-panel-note">They sign in with the Google account for this email</p>
        </div>
        <form
          className="v3-form-row"
          onSubmit={e => {
            e.preventDefault()
            run(() => addUser(email, newRole, note), () => { setEmail(''); setNote(''); setNewRole('viewer') })
          }}
        >
          <label className="v3-field">
            <span>Google email</span>
            <input className="v3-input" type="email" required autoComplete="off" placeholder="name@gmail.com"
              value={email} onChange={e => setEmail(e.target.value)} disabled={!dbReady} />
          </label>
          <label className="v3-field">
            <span>Role</span>
            <select className="v3-select" value={newRole} onChange={e => setNewRole(e.target.value as AccessRole)} disabled={!dbReady}>
              {roles.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
          </label>
          <label className="v3-field v3-field-grow">
            <span>Note (optional)</span>
            <input className="v3-input" maxLength={120} placeholder="e.g. Accountant"
              value={note} onChange={e => setNote(e.target.value)} disabled={!dbReady} />
          </label>
          <button className="v3-btn v3-btn-primary" type="submit" disabled={pending || !email || !dbReady}>
            {pending ? 'Saving…' : 'Add'}
          </button>
        </form>
        <p className="v3-panel-note" style={{ marginTop: 'var(--space-3)' }}>
          {roles.map(r => `${r[0].toUpperCase() + r.slice(1)}: ${ROLE_NOTE[r]}`).join(' · ')}
        </p>
        {!dbReady ? <p className="v3-error" role="alert">The database is not connected, so the list can't be edited.</p> : null}
        {error ? <p className="v3-error" role="alert">{error}</p> : null}
      </section>

      <section className="v3-panel v3-span-12" aria-labelledby="u-list">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="u-list">People with access</h2>
          <p className="v3-panel-note">{users.length} {users.length === 1 ? 'person' : 'people'}</p>
        </div>
        <div className="v3-table-wrap">
          <table className="v3-table">
            <thead>
              <tr><th>Person</th><th>Role</th><th>Status</th><th>Last sign-in</th><th className="r"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const you = u.email === me
                const locked = u.source === 'env' || you
                const canEdit = !locked && (isOwner || u.role === 'viewer')
                return (
                  <tr key={u.email}>
                    <td>
                      <div className="v3-user-email">{u.email}</div>
                      <div className="v3-user-sub">
                        {you ? <span className="v3-tag">You</span> : null}
                        {u.source === 'env' ? <span className="v3-tag">Always allowed (Vercel)</span> : null}
                        {u.note ? <span className="dim">{u.note}</span> : null}
                      </div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select className="v3-select" aria-label={`Role for ${u.email}`} value={u.role} disabled={pending}
                          onChange={e => run(() => setRole(u.email, e.target.value as AccessRole))}>
                          {(isOwner ? (['viewer', 'admin', 'owner'] as AccessRole[]) : (['viewer'] as AccessRole[])).map(r =>
                            <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                        </select>
                      ) : (
                        <span className="dim">{u.role[0].toUpperCase() + u.role.slice(1)}</span>
                      )}
                    </td>
                    <td>
                      <span className={u.active ? 'v3-tag paid' : 'v3-tag v3-tag-off'}>{u.active ? 'Active' : 'Locked'}</span>
                    </td>
                    <td className="dim num">{u.last ?? 'Never'}</td>
                    <td className="r">
                      {canEdit ? (
                        <span className="v3-row-actions">
                          <button className="v3-btn" disabled={pending} onClick={() => run(() => setActive(u.email, !u.active))}>
                            {u.active ? 'Lock' : 'Unlock'}
                          </button>
                          {confirm === u.email ? (
                            <button className="v3-btn v3-btn-danger" disabled={pending}
                              onClick={() => run(() => removeUser(u.email), () => setConfirm(null))}>
                              Confirm remove
                            </button>
                          ) : (
                            <button className="v3-btn" disabled={pending} onClick={() => setConfirm(u.email)}>Remove</button>
                          )}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
