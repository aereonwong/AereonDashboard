// Market research — list.my subsale TRANSACTIONS (what units actually sold for, by building).
//
//   node scripts/market/collect-listmy.mjs 50300 50450 50250      postcodes to cover (default: around KLCC)
//
// curl, one page every ~3 s, only paths list.my's robots.txt allows (/subsales/…). Stops on any 403/429.
// Writes .market-data/raw/listmy-<date>.json (git-ignored). Parsing is in lib/market-listmy.mjs (tested).
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { buildingLinks, parseTransactions, parseBuildingName } from '../../lib/market-listmy.mjs';

const POSTCODES = process.argv.slice(2).length ? process.argv.slice(2) : ['50300', '50450', '50250', '50400', '50088'];
// curl with an honest script user-agent. (Node's fetch sends browser-style sec-fetch headers, and list.my then
// returns only the first 6 rows and loads the rest with JS; curl gets the whole server-rendered list.)
const UA = 'market-research-script/1.0 (+personal use)';
const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms + Math.random() * 1000));

async function get(url) {
  const { stdout } = await run('curl', ['-s', '-A', UA, '--max-time', '30', '-w', '\n%{http_code}', url], { maxBuffer: 50e6 });
  const cut = stdout.lastIndexOf('\n');
  const status = Number(stdout.slice(cut + 1));
  if (status === 403 || status === 429) throw new Error(`${status} on ${url} — list.my is limiting us; stopping`);
  return status === 200 ? stdout.slice(0, cut) : null;
}

const buildings = new Map(); // url -> postcode
for (const pc of POSTCODES) {
  const h = await get(`https://list.my/subsales/postcode/${pc}`);
  for (const u of buildingLinks(h || '')) if (!buildings.has(u)) buildings.set(u, pc);
  console.log(`postcode ${pc}: ${buildings.size} buildings so far`);
  await sleep(3000);
}

const out = [];
const seen_at = new Date().toISOString();
let i = 0;
for (const [url, postcode] of buildings) {
  i++;
  const h = await get(`${url}?view=list&group_by_size=false`);
  if (!h) continue;
  const name = parseBuildingName(h);
  const tx = parseTransactions(h);
  for (const t of tx) out.push({ source: 'listmy', building: name, building_url: url, postcode, ...t });
  console.log(`${String(i).padStart(3)}/${buildings.size}  ${name}  ${tx.length} tx`);
  await sleep(3000);
}

const dir = path.resolve('.market-data/raw');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `listmy-${seen_at.slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify({ source: 'listmy', kind: 'transaction', seen_at, postcodes: POSTCODES, rows: out }));
console.log(`\n${out.length} transactions from ${buildings.size} buildings → ${file}`);
