-- Aereon Dashboard — who may sign in with Google (the future User Management).
-- Additive, safe to run twice. Emails in the ADMIN_EMAILS env var always get in without this
-- table (break-glass); rows here are the managed list. Only the server (service role) touches it.
create table if not exists app_users (
  email         text primary key check (email = lower(email)),
  role          text not null default 'viewer' check (role in ('owner','admin','viewer')),
  active        boolean not null default true,   -- false = locked out without deleting the row
  note          text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
alter table app_users enable row level security;   -- no policies: the anon key sees nothing
