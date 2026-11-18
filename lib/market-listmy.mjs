// Parsers for list.my subsale pages (server-rendered HTML). Pure functions — tested in tests/market-math.test.mjs.

const TYPES = ['Serviced Apt', 'Condominium', 'Apartment', 'SOHO', 'Flat', 'Office Lot', 'Shop', 'Terrace', 'Semi-D', 'Bungalow', 'Townhouse', 'Duplex'];
const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));

/** Building pages linked from a postcode page: /subsales/kl/<district>/<township>/<building>. */
export function buildingLinks(html) {
  const set = new Set();
  for (const m of html.matchAll(/href="(https:\/\/list\.my\/subsales\/kl\/[^/"?#]+\/[^/"?#]+\/[^/"?#]+)"/g)) set.add(m[1]);
  return [...set];
}

export function parseBuildingName(html) {
  const m = html.match(/"@type":\s*"Place",\s*"name":\s*"([^"]+)"/);
  return m ? m[1].replace(/\\\//g, '/') : null;
}

/** One row per transaction id. The page repeats each row (mobile + desktop); only the desktop copy names the unit type. */
export function parseTransactions(html) {
  const parts = html.split(/data-tx-href="https:\/\/list\.my\/subsales\/property\/(\d+)"/);
  const rows = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const block = parts[i + 1].slice(0, 4000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const type = TYPES.find((t) => block.includes(t)) || null;
    if (rows.has(id)) {
      rows.get(id).unit_type ??= type;
      continue;
    }
    const price = block.match(/RM\s?([\d,]+)(?!\s?PSF)/);
    const sqft = block.match(/([\d,]+)\s?sqft/);
    const date = parts[i + 1].match(/datetime="(\d{4}-\d{2})"/);
    if (!price || !sqft || !date) continue;
    const level = block.match(/Level\s+(\w+)/);
    rows.set(id, {
      tx_id: id,
      price: num(price[1]),
      sqft: num(sqft[1]),
      month: date[1],
      level: level ? level[1] : null,
      unit_type: type,
    });
  }
  return [...rows.values()];
}
