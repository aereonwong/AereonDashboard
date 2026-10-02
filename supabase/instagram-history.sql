-- Aereon Dashboard — Instagram history (added 2 Oct 2026).
-- Paste into Supabase → SQL Editor → Run, once. Safe to run again.
--
-- ig_snapshots (instagram.sql) keeps the page-ready picture. These three keep
-- the history that picture throws away, so analytics can be built on it later:
--
--   ig_post_metrics       every post's numbers at every refresh — how a post
--                         grows over its first days, and which ones keep going
--   ig_account_snapshots  the account over the last 30 days at each refresh:
--                         totals, followers vs new people, formats, demographics
--   ig_account_daily      one row per day: reach and follows gained. Instagram
--                         only serves 30 days of these, so storing them is the
--                         only way to keep a longer line.

create table if not exists ig_post_metrics (
  captured_at    timestamptz not null,
  media_id       text        not null,
  posted_at      timestamptz,
  type           text,
  views          integer,
  reach          integer,
  likes          integer,
  comments       integer,
  saved          integer,
  shares         integer,
  interactions   integer,
  watch_ms       integer,   -- reels: average watch time per play
  watch_total_ms bigint,    -- reels: all watch time added up
  follows        integer,   -- photos/carousels: follows the post caused
  profile_visits integer,   -- photos/carousels: profile visits the post caused
  primary key (media_id, captured_at)
);
create index if not exists ig_post_metrics_captured_idx on ig_post_metrics (captured_at desc);

create table if not exists ig_account_snapshots (
  id           bigint generated always as identity primary key,
  captured_at  timestamptz not null default now(),
  window_days  integer     not null default 30,
  totals       jsonb       not null default '{}'::jsonb,
  follow_type  jsonb       not null default '{}'::jsonb,
  formats      jsonb       not null default '{}'::jsonb,
  demographics jsonb       not null default '{}'::jsonb
);
create index if not exists ig_account_snapshots_captured_idx on ig_account_snapshots (captured_at desc);

create table if not exists ig_account_daily (
  day           date primary key,
  reach         integer,
  new_followers integer,
  updated_at    timestamptz not null default now()
);

-- Server-side only, like every other table here: RLS on, no policies.
alter table ig_post_metrics      enable row level security;
alter table ig_account_snapshots enable row level security;
alter table ig_account_daily     enable row level security;
