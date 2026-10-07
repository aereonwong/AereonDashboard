-- 90-day Instagram view (7 Oct 2026). Instagram answers account totals for at
-- most 30 days at a time, so each refresh also asks for the two 30-day windows
-- before it and keeps all three here. Safe to run more than once.
alter table ig_account_snapshots add column if not exists windows jsonb not null default '[]'::jsonb;
