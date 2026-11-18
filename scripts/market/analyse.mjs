// Market research — ingest + analyse portal listings and transactions for an area.
//
//   npm run market:analyse                 moves ~/Downloads/market-*.json into .market-data/raw/, then reports
//   npm run market:analyse -- --subject "Alpha Suites" --sqft 500 --price 600000   (flags override subject.json)
//
// Reads every .market-data/raw/*.json (collector output), keeps the latest sighting of each listing, drops
// obvious junk, and writes .market-data/report-<date>.md + .market-data/listings.json (clean, de-duplicated).
// All data stays in the git-ignored .market-data/ folder. Maths lives in lib/market-math.mjs (tested).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clean, dedupe, groupStats, sizeBand, median, quantile, isStudioLike, cleanTx, txByBuilding } from '../../lib/market-math.mjs';

const DATA = path.resolve('.market-data');
const RAW = path.join(DATA, 'raw');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
// Defaults come from the private .market-data/subject.json (Aereon's unit); flags override.
const subjFile = path.join(DATA, 'subject.json');
const sj = fs.existsSync(subjFile) ? JSON.parse(fs.readFileSync(subjFile, 'utf8')) : {};
const subject = {
  name: arg('--subject', sj.project_match || sj.project || ''),
  sqft: Number(arg('--sqft', 0)) || sj.unit?.sqft || null,
  price: Number(arg('--price', 0)) || sj.unit?.net_price || sj.unit?.spa_price || null,
};

// 1. Ingest: move collector files out of Downloads.
fs.mkdirSync(RAW, { recursive: true });
const dl = path.join(os.homedir(), 'Downloads');
for (const f of fs.readdirSync(dl).filter((f) => /^market-[a-z]+-.+\.json$/.test(f))) {
  let dest = path.join(RAW, f);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(RAW, f.replace(/\.json$/, `-${i}.json`));
  fs.renameSync(path.join(dl, f), dest);
  console.log('ingested', path.basename(dest));
}

// 2. Load.
const all = [];
const txAll = [];
for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  if (/^market-pg-test/.test(f)) continue;
  if (d.kind === 'transaction') {
    for (const r of d.rows || []) txAll.push(r);
    continue;
  }
  for (const r of d.rows || []) all.push({ ...r, seen_at: r.seen_at || d.seen_at });
}
const rows = clean(dedupe(all));
fs.writeFileSync(path.join(DATA, 'listings.json'), JSON.stringify(rows, null, 1));

// 3. Report.
const rm = (n) => (n == null ? '—' : 'RM ' + Math.round(n).toLocaleString('en-MY'));
const rm2 = (n) => (n == null ? '—' : 'RM ' + n.toFixed(2));
const out = [];
const P = (s = '') => out.push(s);
const day = new Date().toISOString().slice(0, 10);
const areas = [...new Set(rows.map((r) => r.area).filter(Boolean))];
P(`# Market profile — ${areas.join(' & ') || 'area'} (${day})`);
P();
P(`Source: PropertyGuru asking prices (not transactions). ${rows.length} clean listings after de-duplication ` +
  `(${rows.filter((r) => r.kind === 'sale').length} for sale, ${rows.filter((r) => r.kind === 'rent').length} for rent).`);
P('Asking prices run above what units actually sell for — check against transaction data (Brickz / NAPIC) before deciding.');
P();

for (const area of areas) {
  P(`## ${area}`);
  P();
  P('| Size band | Sale n | Median price | Median psf | Rent n | Median rent | Median rent psf | Gross yield |');
  P('|---|---|---|---|---|---|---|---|');
  for (const band of ['< 500 sqft', '500–699', '700–899', '900–1,199', '1,200+']) {
    const s = rows.filter((r) => r.area === area && r.kind === 'sale' && sizeBand(r.sqft) === band);
    const t = rows.filter((r) => r.area === area && r.kind === 'rent' && sizeBand(r.sqft) === band);
    const sp = median(s.map((r) => r.psf));
    const tp = median(t.map((r) => r.psf));
    const y = sp && tp ? ((tp * 12) / sp) * 100 : null;
    P(`| ${band} | ${s.length} | ${rm(median(s.map((r) => r.price)))} | ${rm(sp)} | ${t.length} | ${rm(median(t.map((r) => r.price)))} | ${rm2(tp)} | ${y ? y.toFixed(1) + '%' : '—'} |`);
  }
  P();
}

P('## Projects (5+ listings), sorted by sale psf');
P();
P('| Project | Area | Sale n | Median sale psf | Median size | Rent n | Median rent | Rent psf | Gross yield |');
P('|---|---|---|---|---|---|---|---|---|');
const projects = groupStats(rows).filter((g) => g.sale.n + g.rent.n >= 5);
projects.sort((a, b) => (b.sale.psf ?? 0) - (a.sale.psf ?? 0));
for (const g of projects) {
  P(`| ${g.title} | ${g.area} | ${g.sale.n} | ${rm(g.sale.psf)} | ${g.sale.sqft ?? g.rent.sqft ?? '—'} | ${g.rent.n} | ${rm(g.rent.price)} | ${rm2(g.rent.psf)} | ${g.yield ? g.yield.toFixed(1) + '%' : '—'} |`);
}
P();

// Transactions (list.my): what units actually sold for.
const tx = cleanTx(txAll);
const since = String(new Date().getFullYear() - 3);
const recent = tx.filter((t) => t.month >= since);
if (tx.length) {
  P(`## Transactions — what units actually sold for (list.my, ${tx.length} subsales, ${recent.length} since ${since})`);
  P();
  P('Small units (≤ 700 sqft), all buildings, by year:');
  P();
  P('| Year | n | Median price | Median psf | p25 psf | p75 psf |');
  P('|---|---|---|---|---|---|');
  const years = [...new Set(tx.map((t) => t.month.slice(0, 4)))].sort();
  for (const y of years) {
    const x = tx.filter((t) => t.month.startsWith(y) && t.sqft <= 700);
    if (!x.length) continue;
    const ps = x.map((t) => t.psf);
    P(`| ${y} | ${x.length} | ${rm(median(x.map((t) => t.price)))} | ${rm(median(ps))} | ${rm(quantile(ps, 0.25))} | ${rm(quantile(ps, 0.75))} |`);
  }
  P();
  P(`Buildings with 3+ sales since ${since} (residential only), sorted by median psf:`);
  P();
  P('| Building | Postcode | n | Median price | Median psf | Median size | Small-unit (≤700) psf | Latest |');
  P('|---|---|---|---|---|---|---|---|');
  for (const b of txByBuilding(recent).filter((b) => b.n >= 3)) {
    P(`| ${b.building} | ${b.postcode} | ${b.n} | ${rm(b.price)} | ${rm(b.psf)} | ${Math.round(b.sqft)} | ${rm(b.smallPsf)} | ${b.latest} |`);
  }
  P();
}

// Subject vs. comparable small units (studio / 1-bed, 350–650 sqft) in both areas.
const subj = rows.filter((r) => r.title.toLowerCase().includes(subject.name.toLowerCase()));
const comps = rows.filter((r) => isStudioLike(r) && r.title.toLowerCase().indexOf(subject.name.toLowerCase()) < 0);
P(`## ${subject.name} vs. comparable small units (350–650 sqft, studio / 1-bed)`);
P();
const sSale = subj.filter((r) => r.kind === 'sale');
P(`${subject.name} listings found: ${subj.length} (${sSale.length} for sale; median ${rm(median(sSale.map((r) => r.psf)))} psf, ` +
  `range ${rm(Math.min(...sSale.map((r) => r.price)))}–${rm(Math.max(...sSale.map((r) => r.price)))}).`);
if (subject.price && subject.sqft) P(`Your unit: ${rm(subject.price)} for ${subject.sqft} sqft = ${rm(subject.price / subject.sqft)} psf.`);
P();
const cs = comps.filter((r) => r.kind === 'sale').map((r) => r.psf);
const cr = comps.filter((r) => r.kind === 'rent');
P(`Comparable for sale: ${cs.length} listings — psf p25 ${rm(quantile(cs, 0.25))}, median ${rm(median(cs))}, p75 ${rm(quantile(cs, 0.75))}.`);
P(`Comparable for rent (long-term): ${cr.length} listings — median ${rm(median(cr.map((r) => r.price)))}/month, ${rm2(median(cr.map((r) => r.psf)))} psf.`);
if (cs.length && cr.length) {
  const ltYield = ((median(cr.map((r) => r.psf)) * 12) / median(cs)) * 100;
  P(`Long-term gross yield on comparable units: ${ltYield.toFixed(1)}% (before fees, maintenance, vacancy).`);
}
P();
const smallTx = recent.filter((t) => t.sqft >= 350 && t.sqft <= 700).map((t) => t.psf);
if (smallTx.length) P(`Transacted small units (350–700 sqft) since ${since}: ${smallTx.length} sales — psf p25 ${rm(quantile(smallTx, 0.25))}, median ${rm(median(smallTx))}, p75 ${rm(quantile(smallTx, 0.75))}.`);
P();
P('Short-term (Airbnb) income is NOT in this report yet — next step is nightly rate + occupancy for the same comps.');

const file = path.join(DATA, `report-${day}.md`);
fs.writeFileSync(file, out.join('\n') + '\n');
console.log(out.join('\n'));
console.log('\nwrote', file);
