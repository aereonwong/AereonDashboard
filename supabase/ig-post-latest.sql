-- The latest reading of every Instagram post, one row per post.
-- The Dashboard's "Reach and invoicing" panel reads this (lib/v3/ig-extras.ts,
-- readPostReach). Without it the app still works: it reads every stored reading
-- and keeps the latest, which gets slower as history grows.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- security_invoker: the view obeys ig_post_metrics' own row security instead of
-- bypassing it, and the public (anon) and signed-in roles get no access at all —
-- only the server's service role reads it.

create or replace view ig_post_latest
with (security_invoker = true) as
select distinct on (media_id) media_id, posted_at, reach, captured_at
from ig_post_metrics
where reach is not null
order by media_id, captured_at desc;

revoke all on ig_post_latest from anon, authenticated;
