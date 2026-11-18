import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, quantile, dedupe, clean, sizeBand, isStudioLike, groupStats, cleanTx, txByBuilding } from '../lib/market-math.mjs';
import { parseTransactions, buildingLinks, parseBuildingName } from '../lib/market-listmy.mjs';

const L = (o) => ({ portal: 'pg', listing_id: '1', kind: 'sale', title: 'Alpha Suites', area: 'Town', price: 500000, sqft: 500, beds: 1, seen_at: '2026-01-01', ...o });

test('median and quantile ignore non-numbers', () => {
  assert.equal(median([3, 1, 2, null, NaN]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(quantile([10, 20, 30, 40, 50], 0.25), 20);
  assert.equal(median([]), null);
});

test('dedupe keeps the latest sighting and the first-seen date', () => {
  const out = dedupe([L({ price: 1, seen_at: '2026-01-02' }), L({ price: 2, seen_at: '2026-01-05' }), L({ price: 3, seen_at: '2026-01-01' })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].price, 2);
  assert.equal(out[0].first_seen, '2026-01-01');
});

test('clean drops junk and adds psf', () => {
  const out = clean([
    L({ listing_id: 'a' }),
    L({ listing_id: 'b', sqft: null }),
    L({ listing_id: 'c', price: 50000 }), // too cheap for a sale
    L({ listing_id: 'd', kind: 'rent', price: 2000 }),
    L({ listing_id: 'e', kind: 'rent', price: 300 }), // too cheap for a rent
  ]);
  assert.deepEqual(out.map((r) => r.listing_id), ['a', 'd']);
  assert.equal(out[0].psf, 1000);
  assert.equal(out[1].psf, 4);
});

test('size bands and the studio-like comparable set', () => {
  assert.equal(sizeBand(450), '< 500 sqft');
  assert.equal(sizeBand(700), '700–899');
  assert.equal(sizeBand(1500), '1,200+');
  assert.ok(isStudioLike({ sqft: 450, beds: -1 }));
  assert.ok(!isStudioLike({ sqft: 450, beds: 2 }));
  assert.ok(!isStudioLike({ sqft: 900, beds: 1 }));
});

test('groupStats gives per-project medians and gross yield', () => {
  const rows = clean([
    L({ listing_id: '1', price: 500000, sqft: 500 }),
    L({ listing_id: '2', price: 600000, sqft: 500 }),
    L({ listing_id: '3', kind: 'rent', price: 2500, sqft: 500 }),
  ]);
  const [g] = groupStats(rows);
  assert.equal(g.sale.n, 2);
  assert.equal(g.sale.psf, 1100);
  assert.equal(g.rent.psf, 5);
  assert.equal(Math.round(g.yield * 100) / 100, 5.45); // 5 × 12 / 1100
});

test('cleanTx drops offices and duplicate ids; txByBuilding gives medians', () => {
  const T = (o) => ({ source: 'listmy', tx_id: '1', building: 'Alpha', postcode: '10000', price: 600000, sqft: 600, month: '2025-01', unit_type: null, ...o });
  const tx = cleanTx([T({}), T({}), T({ tx_id: '2', price: 800000, sqft: 800, month: '2026-02' }), T({ tx_id: '3', unit_type: 'Office Lot' })]);
  assert.equal(tx.length, 2);
  const [b] = txByBuilding(tx);
  assert.equal(b.n, 2);
  assert.equal(b.psf, 1000);
  assert.equal(b.smallPsf, 1000);
  assert.equal(b.latest, '2026-02');
});

test('list.my parsers read transaction rows, building links and name', () => {
  const row = (id, price, sqft, ym, type = '') =>
    `<div data-tx-href="https://list.my/subsales/property/${id}"><div>RM${price}</div><div>Level 9</div><span>${sqft} sqft</span><span>RM1,000 PSF</span><time datetime="${ym}">x</time><span>${type}</span></div>`;
  const html = `<script>{"@type": "Place", "name": "Alpha Suites"}</script>` + row(11, '500,000', '500', '2025-03') + row(11, '500,000', '500', '2025-03', 'Serviced Apt') + row(12, '700,000', '700', '2026-01') +
    '<a href="https://list.my/subsales/kl/town/area/alpha-suites">a</a><a href="https://list.my/subsales/kl/township/area">b</a>';
  const t = parseTransactions(html);
  assert.equal(t.length, 2);
  assert.deepEqual(t[0], { tx_id: '11', price: 500000, sqft: 500, month: '2025-03', level: '9', unit_type: 'Serviced Apt' });
  assert.deepEqual(buildingLinks(html), ['https://list.my/subsales/kl/town/area/alpha-suites']);
  assert.equal(parseBuildingName(html), 'Alpha Suites');
});
