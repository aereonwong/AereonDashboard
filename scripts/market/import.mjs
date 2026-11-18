// Market research — load .market-data/raw/*.json into Supabase (market_listing + market_listing_seen + market_transaction).
//
//   npm run market:import -- --dry     count what would be written, write nothing
//   npm run market:import              upsert
//
// Needs supabase/market.sql run once. Idempotent: re-running the same files changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { clean } from '../../lib/market-math.mjs';

const RAW = path.resolve('.market-data/raw');
const dry = process.argv.includes('--dry');

const sightings = [];
const txRows = new Map();
for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.json') && !f.startsWith('market-pg-test'))) {
  const d = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  if (d.kind === 'transaction') {
    for (const t of d.rows || [])
      txRows.set(t.source + ':' + t.tx_id, { source: t.source, tx_id: t.tx_id, building: t.building, building_url: t.building_url, postcode: t.postcode,
        month: t.month + '-01', price: t.price, sqft: t.sqft, level: t.level, unit_type: t.unit_type });
    continue;
  }
  for (const r of d.rows || []) sightings.push({ ...r, seen_at: r.seen_at || d.seen_at });
}
const ok = clean(sightings);
const listings = new Map();
const seen = new Map();
for (const r of ok) {
  const k = r.portal + ':' + r.listing_id;
  const prev = listings.get(k);
  const first = prev && prev.first_seen < r.seen_at ? prev.first_seen : r.seen_at;
  if (!prev || r.seen_at >= prev.last_seen)
    listings.set(k, {
      portal: r.portal, listing_id: r.listing_id, kind: r.kind, title: r.title, project_id: r.project_id == null ? null : String(r.project_id),
      new_project: !!r.new_project, unit_type: r.unit_type, price: r.price, sqft: r.sqft, beds: r.beds, baths: r.baths, furnish: r.furnish,
      tenure: r.tenure, area: r.area, district: r.district, address: r.address, availability: r.availability, url: r.url,
      posted_at: r.posted_unix ? new Date(r.posted_unix * 1000).toISOString() : null, first_seen: first, last_seen: r.seen_at,
    });
  else prev.first_seen = first;
  seen.set(k + ':' + r.seen_at.slice(0, 10), { portal: r.portal, listing_id: r.listing_id, seen_on: r.seen_at.slice(0, 10), price: r.price });
}
console.log(`${txRows.size} transactions; ${sightings.length} sightings → ${ok.length} clean → ${listings.size} listings, ${seen.size} price points`);
if (dry) process.exit(0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const db = createClient(url.trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, ''), key.trim(), { auth: { persistSession: false } });
async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
await upsert('market_listing', [...listings.values()], 'portal,listing_id');
await upsert('market_listing_seen', [...seen.values()], 'portal,listing_id,seen_on');
await upsert('market_transaction', [...txRows.values()].filter((t) => t.building && t.price > 0 && t.sqft > 0), 'source,tx_id');
console.log('done');
