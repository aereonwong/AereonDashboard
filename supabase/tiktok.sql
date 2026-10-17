-- TikTok history (17 Oct 2026). TikTok's API gives only today's totals — account counts and
-- each PUBLIC video's lifetime views/likes/comments/shares — no daily history, reach, watch time
-- or audience. So history is what we store: one account row per day, one reading per video per
-- capture. Filled by the daily cron (with Instagram and Facebook) and `npm run tt:backfill`.
-- Safe to run more than once.
--
--   tt_account_daily   one row per account per day (Malaysia date): followers, following, likes, videos
--   tt_posts           one row per public video: caption, length, link, cover
--   tt_post_metrics    a row per video per capture: lifetime views, likes, comments, shares

create table if not exists tt_account_daily (
  username     text not null,
  day          date not null,        -- Malaysia date of the reading; a later reading that day replaces it
  followers    integer,
  following    integer,
  likes        bigint,               -- total likes across every video, as TikTok counts them
  video_count  integer,              -- includes private videos, so it can be above the public videos stored
  captured_at  timestamptz not null default now(),
  primary key (username, day)
);

create table if not exists tt_posts (
  video_id     text primary key,
  username     text not null,
  posted_at    timestamptz,
  title        text,                 -- the caption
  duration     integer,              -- seconds
  share_url    text,
  embed_link   text,
  cover_url    text,                 -- TikTok CDN link: expires within days, only a convenience
  updated_at   timestamptz not null default now()
);
create index if not exists tt_posts_posted_idx on tt_posts (username, posted_at desc);

create table if not exists tt_post_metrics (
  video_id     text not null,
  captured_at  timestamptz not null,
  views        bigint,
  likes        integer,
  comments     integer,
  shares       integer,
  primary key (video_id, captured_at)
);
create index if not exists tt_post_metrics_captured_idx on tt_post_metrics (captured_at desc);

-- Latest reading per video, for the page and the dashboard.
create or replace view tt_post_latest with (security_invoker = true) as
select distinct on (video_id) video_id, captured_at, views, likes, comments, shares
from tt_post_metrics
order by video_id, captured_at desc;

alter table tt_account_daily enable row level security;
alter table tt_posts enable row level security;
alter table tt_post_metrics enable row level security;
