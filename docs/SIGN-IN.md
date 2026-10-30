# Sign-in — Google + backup passcode

<!-- Moved out of the root CLAUDE.md on 30 Oct 2026 so it loads only when needed. Unchanged text. -->

## Sign-in (Google + backup passcode, added 4 Oct 2026)

Front door is **Sign in with Google** (`lib/google-auth.ts`, `app/api/auth/google/**`: OIDC code flow +
PKCE, hand-written, no auth library). Active only when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set;
until then the login page is the old passcode form. A verified Google account must also be allowed:
- `ADMIN_EMAILS` (env, comma-separated) — always in, needs no database. This is the break-glass list:
  keep a second Google account on it.
- `app_users` table (`supabase/app-users.sql`) — the managed list, edited on the **Users** page (`/users`,
  `app/(app)/users/`): role owner/admin/viewer, `active` (Lock), `last_login_at`. Owner manages everyone; admin
  manages viewers only; nobody edits their own row; ADMIN_EMAILS people show read-only (role owner). Since 12 Oct 2026 a
  viewer is read-only: `requireSession()` (every server action) and `canEdit()` refuse them; they can still open every tab, and v3 hides
  controls marked `data-edit` for them (`data-view-only` on the shell).
- Session cookie `cfo_session` = `exp.nonce.who.sig`; `who` = `pw` (passcode) or the Google email.
  Signed with `AUTH_SECRET` (falls back to `APP_PASSCODE`). Rotating it signs everyone out. `signedIn()`
  (lib/auth.ts, used by the (app) layout and every server action) re-checks a Google account against the list,
  so Lock/Remove cuts someone off on their next click. The proxy only checks the cookie signature.
- On production with no `AUTH_SECRET`/`APP_PASSCODE` the app now fails CLOSED (`openDoor()` in lib/session.ts);
  local and preview runs still open without a secret.
- Backup access ladder: second Google account → passcode (`APP_PASSCODE`, behind "Use backup passcode") →
  edit env vars in Vercel. `PASSCODE_LOGIN=off` retires the passcode and invalidates its sessions.
  Once `AUTH_SECRET` is set, rotating `APP_PASSCODE` no longer kills existing passcode sessions — rotate
  `AUTH_SECRET` or set `PASSCODE_LOGIN=off` instead.
- Google redirects only to one host (`APP_BASE_URL`, default https://aereonwong.com), registered in
  Google Cloud. `/api/logout` (POST) clears the cookie; Sign out is in the v3 rail, the classic sidebar and Settings → Account.
  The login page (`app/login/`) is Studio Standard: KLCC photo beside the form, passcode folded under the Google button.

