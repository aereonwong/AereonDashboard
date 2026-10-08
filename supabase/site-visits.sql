-- Aereon Dashboard — first-party visitor log for the public pages (8 Oct 2026).
-- Additive, safe to run twice. One row per page view. No IP address and no cookie is stored:
-- visitor_hash is a daily-rotating hash, so it counts unique visitors within one day only and
-- cannot follow anyone across days. Only the server (service role) touches it.
create table if not exists site_visits (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  day           date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  path          text not null,
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  country       text,
  city          text,
  device        text,   -- mobile | tablet | desktop
  browser       text,
  os            text,
  visitor_hash  text not null
);
create index if not exists site_visits_day_idx  on site_visits (day);
create index if not exists site_visits_path_idx on site_visits (path, day);
alter table site_visits enable row level security;   -- no policies: the anon key sees nothing
