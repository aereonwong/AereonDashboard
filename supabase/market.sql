-- Aereon Dashboard — Market research: property-portal listings around an area Aereon is studying.
-- Asking prices only (sale and long-term rent), collected by scripts/market/ — never Aereon's own property figures.
-- Additive: three new tables, nothing existing touched. Safe to run twice. No data in the repo: rows are loaded by
-- `npm run market:import` from the git-ignored .market-data/ folder.

-- One row per portal listing; the latest sighting overwrites price and status.
create table if not exists market_listing (
  portal        text    not null,                 -- propertyguru | iproperty | mudah | edgeprop
  listing_id    text    not null,                 -- the portal's own id
  kind          text    not null check (kind in ('sale','rent')),
  title         text    not null,                 -- project / building name as listed
  project_id    text,                             -- portal's project id, when it has one
  new_project   boolean not null default false,
  unit_type     text,                             -- Service Residence, Condominium, SOHO …
  price         numeric(14,2) not null,           -- RM; per month when kind = rent
  sqft          numeric(10,2),
  beds          smallint,                         -- -1 = studio
  baths         smallint,
  furnish       text,
  tenure        text,                             -- F freehold, L leasehold, M malay reserve
  area          text,                             -- KLCC, Kampung Baru …
  district      text,
  address       text,
  availability  text,
  url           text,
  posted_at     timestamptz,
  first_seen    timestamptz not null,
  last_seen     timestamptz not null,
  primary key (portal, listing_id)
);
create index if not exists market_listing_area_idx on market_listing (area, kind);
create index if not exists market_listing_title_idx on market_listing (lower(title));

-- Price history: one row per listing per day it was seen, so price cuts and time-on-market show up.
create table if not exists market_listing_seen (
  portal      text not null,
  listing_id  text not null,
  seen_on     date not null,
  price       numeric(14,2) not null,
  primary key (portal, listing_id, seen_on),
  foreign key (portal, listing_id) references market_listing (portal, listing_id) on delete cascade
);

-- Subsale transactions (what units actually sold for), one row per source transaction — list.my for now.
create table if not exists market_transaction (
  source      text    not null,                 -- listmy
  tx_id       text    not null,
  building    text    not null,
  building_url text,
  postcode    text,
  month       date    not null,                 -- first of the month the sale was recorded
  price       numeric(14,2) not null,
  sqft        numeric(10,2) not null,
  level       text,
  unit_type   text,                             -- Serviced Apt, Condominium, Office Lot …
  first_seen  timestamptz not null default now(),
  primary key (source, tx_id)
);
create index if not exists market_transaction_building_idx on market_transaction (building, month desc);

-- Server-only, like every other table here: RLS on, no policies; the app reads with the service role.
alter table market_listing enable row level security;
alter table market_listing_seen enable row level security;
alter table market_transaction enable row level security;
