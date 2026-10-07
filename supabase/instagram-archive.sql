-- Instagram archive (7 Oct 2026): everything Instagram will give, stored once so
-- analytics read the database instead of asking Instagram again. Filled by
-- `npm run ig:backfill`; safe to run more than once.
--
--   ig_posts             one row per post ever published: caption, type, link, likes, comments
--   ig_post_metrics      (existing) a row per post per capture — the backfill adds one for every post
--   ig_account_periods   account totals per 30-day window, as far back as Instagram answers (about 2 years)
--   ig_account_daily     (existing) daily reach — the backfill extends it back as far as Instagram answers

create table if not exists ig_posts (
  media_id       text primary key,
  shortcode      text,
  posted_at      timestamptz,
  type           text,         -- REELS | FEED | STORY
  media_type     text,         -- IMAGE | VIDEO | CAROUSEL_ALBUM
  caption        text,
  permalink      text,
  likes          integer,
  comments       integer,
  children       integer,      -- carousel: how many slides
  updated_at     timestamptz not null default now()
);
create index if not exists ig_posts_posted_idx on ig_posts (posted_at desc);

create table if not exists ig_account_periods (
  since        timestamptz not null,
  until        timestamptz not null,
  totals       jsonb       not null default '{}'::jsonb, -- reach & accounts_engaged are unique per window: never add them up
  formats      jsonb       not null default '{}'::jsonb, -- reach and views per format (reel, post, story, ad…)
  follow_type  jsonb       not null default '{}'::jsonb, -- followers vs non-followers
  captured_at  timestamptz not null default now(),
  primary key (since, until)
);

alter table ig_posts enable row level security;
alter table ig_account_periods enable row level security;
