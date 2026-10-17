-- 👉 social_snapshots — the whole cross-platform picture /social and the Dashboard's audience band draw,
-- computed once and stored, so a page load reads one row instead of recalculating from every history
-- table. One row per Malaysia day × window (30, 90, 365 days); `data` is the result of buildSocial()
-- (lib/v3/social-math.ts) with the post lists trimmed to what the pages show. Written with
-- social_totals by lib/social-totals.ts after the 6am refresh, after any Refresh button, and from
-- POST /api/social/totals. Safe to run more than once.

create table if not exists public.social_snapshots (
  day          date        not null,
  window_days  int         not null,
  data         jsonb       not null,
  computed_at  timestamptz not null default now(),
  primary key (day, window_days)
);

-- Server-only, like the other history tables: the service key writes and reads; nobody else.
alter table public.social_snapshots enable row level security;
