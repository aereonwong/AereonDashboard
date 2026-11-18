// Market research maths — pure functions, no I/O. Used by scripts/market/analyse.mjs (and later by a page).
// Asking-price listings only; never mix with Aereon's own property figures.

export function median(xs) {
  return quantile(xs, 0.5);
}

export function quantile(xs, q) {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}

/** Latest sighting of each listing wins (same portal + listing id). */
export function dedupe(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = r.portal + ':' + r.listing_id;
    const prev = by.get(k);
    if (!prev || String(r.seen_at) > String(prev.seen_at)) by.set(k, { ...r, first_seen: prev?.first_seen ?? r.seen_at });
    else if (String(r.seen_at) < String(prev.first_seen)) prev.first_seen = r.seen_at;
  }
  return [...by.values()];
}

/** Drop rows that can't be compared: no price/size, or values outside sane bounds. Adds psf. */
export function clean(rows) {
  return rows
    .filter((r) => r.price > 0 && r.sqft >= 150 && r.sqft <= 10000)
    .filter((r) => (r.kind === 'rent' ? r.price >= 500 && r.price <= 100000 : r.price >= 100000))
    .map((r) => ({ ...r, title: String(r.title || '').trim(), psf: r.price / r.sqft }))
    .filter((r) => (r.kind === 'rent' ? r.psf <= 20 : r.psf >= 200 && r.psf <= 6000));
}

export function sizeBand(sqft) {
  if (sqft < 500) return '< 500 sqft';
  if (sqft < 700) return '500–699';
  if (sqft < 900) return '700–899';
  if (sqft < 1200) return '900–1,199';
  return '1,200+';
}

/** Studio or 1-bed between 350 and 650 sqft — the comparable set for a single short-stay unit. */
export function isStudioLike(r) {
  return r.sqft >= 350 && r.sqft <= 650 && (r.beds == null || r.beds <= 1);
}

/** Per project (title + area): sale/rent counts and medians, plus gross yield from median psf. */
export function groupStats(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = r.title.toLowerCase() + '|' + r.area;
    if (!by.has(k)) by.set(k, { title: r.title, area: r.area, rows: [] });
    by.get(k).rows.push(r);
  }
  return [...by.values()].map((g) => {
    const side = (kind) => {
      const x = g.rows.filter((r) => r.kind === kind);
      return { n: x.length, price: median(x.map((r) => r.price)), psf: median(x.map((r) => r.psf)), sqft: median(x.map((r) => r.sqft)) };
    };
    const sale = side('sale');
    const rent = side('rent');
    const yld = sale.psf && rent.psf ? ((rent.psf * 12) / sale.psf) * 100 : null;
    return { title: g.title, area: g.area, sale, rent, yield: yld };
  });
}

const NON_RESIDENTIAL = /office|shop|retail|commercial|industrial|land/i;

/** Transactions: drop non-residential and junk, add psf. One row per source transaction id. */
export function cleanTx(rows) {
  const by = new Map();
  for (const t of rows) by.set(t.source + ':' + t.tx_id, t);
  return [...by.values()]
    .filter((t) => t.price >= 100000 && t.sqft >= 150 && t.sqft <= 10000 && !NON_RESIDENTIAL.test(t.unit_type || ''))
    .map((t) => ({ ...t, psf: t.price / t.sqft }))
    .filter((t) => t.psf >= 200 && t.psf <= 6000);
}

/** Per building: count, medians, small-unit (≤ 700 sqft) psf, latest month. Sorted by median psf, high first. */
export function txByBuilding(tx) {
  const by = new Map();
  for (const t of tx) {
    if (!by.has(t.building)) by.set(t.building, []);
    by.get(t.building).push(t);
  }
  return [...by.entries()]
    .map(([building, x]) => ({
      building,
      postcode: x[0].postcode,
      n: x.length,
      price: median(x.map((t) => t.price)),
      psf: median(x.map((t) => t.psf)),
      sqft: median(x.map((t) => t.sqft)),
      smallPsf: median(x.filter((t) => t.sqft <= 700).map((t) => t.psf)),
      latest: x.map((t) => t.month).sort().pop(),
    }))
    .sort((a, b) => b.psf - a.psf);
}
