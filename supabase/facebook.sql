-- Facebook Page history (12 Oct 2026). Same idea as the Instagram archive: store
-- what Facebook gives once, so the dashboard reads the database, not Facebook.
-- Filled by the daily cron (with Instagram) and `npm run fb:backfill`. Safe to run more than once.
--
--   fb_page_daily     one row per Page per day: followers, follows/unfollows, views, unique viewers, engagements
--   fb_page_periods   28-day windows as Facebook counts them — unique viewers are only true per window
--   fb_posts          one row per post: text, type, link, picture, reactions, comments, shares
--   fb_post_metrics   a row per post per capture: views and unique viewers (Meta's post metrics since Nov 2025)

create table if not exists fb_page_daily (
  page_id      text not null,
  day          date not null,        -- the Pacific-time day Facebook reports (its end_time minus one day)
  followers    integer,
  follows      integer,
  unfollows    integer,
  views        integer,              -- page_media_view
  viewers      integer,              -- page_total_media_view_unique — unique for that day only: never add days up
  engagements  integer,              -- page_post_engagements
  video_views  integer,
  captured_at  timestamptz not null default now(),
  primary key (page_id, day)
);

create table if not exists fb_page_periods (
  page_id      text not null,
  until        date not null,        -- last day of the 28-day window
  views        integer,
  viewers      integer,              -- unique per window: never add windows together
  engagements  integer,
  captured_at  timestamptz not null default now(),
  primary key (page_id, until)
);

create table if not exists fb_posts (
  post_id      text primary key,
  page_id      text not null,
  posted_at    timestamptz,
  status_type  text,                 -- added_video | added_photos | shared_story | mobile_status_update …
  type         text,                 -- VIDEO | PHOTO | LINK | TEXT
  message      text,
  permalink    text,
  picture      text,                 -- Facebook CDN link: expires, so only a convenience
  reactions    integer,
  comments     integer,
  shares       integer,
  updated_at   timestamptz not null default now()
);
create index if not exists fb_posts_posted_idx on fb_posts (page_id, posted_at desc);

create table if not exists fb_post_metrics (
  post_id      text not null,
  captured_at  timestamptz not null,
  views        integer,              -- post_media_view (lifetime)
  viewers      integer,              -- post_total_media_view_unique (lifetime)
  primary key (post_id, captured_at)
);
create index if not exists fb_post_metrics_captured_idx on fb_post_metrics (captured_at desc);

-- Latest reading per post, for the page and the dashboard.
create or replace view fb_post_latest with (security_invoker = true) as
select distinct on (post_id) post_id, captured_at, views, viewers
from fb_post_metrics
order by post_id, captured_at desc;

alter table fb_page_daily enable row level security;
alter table fb_page_periods enable row level security;
alter table fb_posts enable row level security;
alter table fb_post_metrics enable row level security;
