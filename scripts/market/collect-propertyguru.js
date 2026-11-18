// Market research — PropertyGuru collector.
//
// PropertyGuru blocks scripts (Cloudflare 403), so this runs INSIDE a normal propertyguru.com.my tab in Aereon's
// own Chrome (pasted through the Chrome tool's javascript runner). It never solves or dodges a bot check: if a page
// comes back without data it stops. Polite: one page every 2.5–4 s, capped by MAX_PAGES.
// Keeps listing facts only — no agent names, phones or photos.
// Output: rows collect in the site's localStorage; saveMarketRows() saves ONE `market-pg-<date>.json` to ~/Downloads
// and `npm run market:analyse` moves it into the git-ignored .market-data/raw/ folder.
// Aereon approved this save-to-Downloads route on 18 Nov 2026.
//
//   collectPropertyGuru([{ q: 'klcc-sale', url: '/property-for-sale?districtCode=kpycl&areaCode=jgrve&maxSize=1200' }])
//   … when done, in a freshly opened propertyguru tab (Chrome blocks a 2nd download per page): saveMarketRows()
window.collectPropertyGuru = async function (JOBS, { MAX_PAGES = 120, DELAY = 3000 } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms + Math.random() * 1000));
  const unitType = (l) => (l.badges || []).find((b) => b.name === 'unit_type')?.text || l.property?.subTypeText || null;
  const furnish = (l) => {
    const t = JSON.stringify(l.listingFeatures || '');
    return /fully furnished/i.test(t) ? 'full' : /partially furnished/i.test(t) ? 'partial' : /unfurnished/i.test(t) ? 'none' : null;
  };
  const row = (l) => ({
    portal: 'propertyguru',
    listing_id: String(l.id),
    url: l.url,
    kind: l.typeCode === 'RENT' ? 'rent' : 'sale',
    title: l.localizedTitle,
    project_id: l.property?.id ?? null,
    new_project: !!l.property?.newProject,
    unit_type: unitType(l),
    price: l.price?.value ?? null,
    sqft: l.floorArea ?? null,
    beds: l.bedrooms ?? null,
    baths: l.bathrooms ?? null,
    furnish: furnish(l),
    tenure: l.additionalData?.tenure ?? null,
    area: l.additionalData?.areaText || null,
    district: l.additionalData?.districtText || null,
    address: l.fullAddress,
    availability: l.availabilityInfo || null,
    lister: l.listerType || null,
    posted_unix: l.postedOn?.unix ?? null,
  });
  async function page(url) {
    const h = await (await fetch(url, { credentials: 'include' })).text();
    const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('no data on ' + url + ' — blocked or layout changed; stopping');
    return JSON.parse(m[1]).props.pageProps.pageData.data;
  }
  // Chrome allows ONE automatic download per page, so rows pile up in this site's localStorage (survives reloads)
  // and saveMarketRows() writes them all as one file — run it from a freshly opened propertyguru tab.
  function keep(rows) {
    const store = JSON.parse(localStorage.getItem('marketRows') || '{}');
    for (const r of rows) store[r.listing_id] = r;
    localStorage.setItem('marketRows', JSON.stringify(store));
  }
  const report = {};
  for (const job of JOBS) {
    let total = 1;
    let n = 0;
    for (let p = 1; p <= Math.min(total, MAX_PAGES); p++) {
      // PropertyGuru pages are /property-for-sale/2?…, /3?…
      const url = p > 1 ? job.url.replace(/^(\/[^?]+)/, `$1/${p}`) : job.url;
      const d = await page(url);
      total = d.paginationData?.totalPages || 1;
      const seen_at = new Date().toISOString();
      const got = (d.listingsData || []).map((x) => x.listingData).filter((l) => l && l.id).map((l) => ({ ...row(l), seen_at, query: job.q }));
      if (!got.length) break;
      keep(got);
      n += got.length;
      window.__marketProgress = { q: job.q, p, total, rows: n };
      await sleep(DELAY);
    }
    report[job.q] = { pages: Math.min(total, MAX_PAGES), of: total, rows: n };
  }
  window.__marketReport = report;
  return report;
};

// Writes everything collected so far as ONE file (market-pg-<date>.json in ~/Downloads), then clears the store.
window.saveMarketRows = function ({ clear = true } = {}) {
  const store = JSON.parse(localStorage.getItem('marketRows') || '{}');
  const rows = Object.values(store);
  const seen_at = rows.map((r) => r.seen_at).sort().pop() || new Date().toISOString();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ source: 'propertyguru', seen_at, rows })], { type: 'application/json' }));
  a.download = `market-pg-${seen_at.slice(0, 10)}.json`;
  a.click();
  if (clear) setTimeout(() => localStorage.removeItem('marketRows'), 3000);
  return rows.length;
};
