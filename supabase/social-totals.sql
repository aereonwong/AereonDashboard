-- 👉 social_totals — the cross-platform figures, computed once a day and read by every public page
-- (landing, media kits, /hello and its share card). Written by lib/social-totals.ts after the daily
-- 6am refresh and after any Refresh button; one row per Malaysia day × platform × window, so it is
-- also a history of the totals. platform = a platform id (ig, fb, tt, later yt, th, xhs) or 'all'.
--
-- Same maths as /social and the Dashboard (lib/v3/social-math.ts): views and interactions are those
-- of the posts PUBLISHED in the window, each at its latest reading. people = the platform's own
-- unique count over its own window (Instagram 30 days, Facebook 28); best_people = its best such
-- window inside the last 90 days. Never added across windows; 'all' adds platforms only.
-- Safe to run more than once.

create table if not exists public.social_totals (
  day           date        not null,
  platform      text        not null,
  window_days   int         not null,
  followers     bigint,
  net30         bigint,
  posts         int,
  unread        int,
  views         bigint,
  interactions  bigint,
  rate          numeric, -- interactions per 100 views, over posts where BOTH were read
  typical       bigint,
  people        bigint,
  best_people   bigint,
  people_window int,
  fresh         boolean     not null default true,
  computed_at   timestamptz not null default now(),
  primary key (day, platform, window_days)
);

-- Added after the first draft; harmless if the column is already there.
alter table public.social_totals add column if not exists rate numeric;

create index if not exists social_totals_latest on public.social_totals (window_days, day desc);

-- Server-only, like the other history tables: the service key writes and reads; nobody else.
alter table public.social_totals enable row level security;
