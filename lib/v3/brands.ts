// 👉 The brands on the public media kit, chosen by Aereon on 26 Sep 2026 for
// prestige and the trust they signal to the next brand — not by how often each
// was invoiced. Order is deliberate: the most recognised lead.
//
// Marks are official vector logos: Simple Icons (CC0) where it covers the brand,
// Wikimedia Commons (public-domain logo files) otherwise, stored in
// public/img/brands/. They are flattened to one ink so the wall reads as a single
// line-up in every world. Sizing is derived from each mark's true aspect ratio
// (see logoSize) rather than tuned by hand.
//
// Kept out, and why: Shangri-La and Visit Dubai have no clean official vector
// available; Singapore Tourism Board's mark sits on a background shape that
// flattens to a solid block. Swap entries here, and drop the SVG in the folder.

/** `kind` is the plain-words caption shown under the mark on media kit v2, so a
 *  symbol-only logo (AirAsia's "a", Insta360's lens) still reads at a glance. */
export type Brand = { slug: string; name: string; aspect: number; kind: string }

/** Optical sizing. Each mark's viewBox is cropped to what is actually drawn, and
 *  its height falls as it gets wider: h = 44 · aspect^−0.4. A square symbol is
 *  44px tall; a long wordmark is shorter but wider, so every mark carries a
 *  similar visual weight. */
export const logoSize = (aspect: number) => {
  const h = Math.round(44 * Math.pow(aspect, -0.4))
  return { h, w: Math.min(170, Math.round(h * aspect)) }
}

// Tourism Malaysia leads: the kit represents Malaysia first (Aereon, 2 Oct 2026).
export const KIT_BRANDS: Brand[] = [
  { slug: 'tourism-malaysia', name: 'Tourism Malaysia', aspect: 2.338, kind: 'National tourism' },
  { slug: 'petronas-towers', name: 'Petronas Twin Towers', aspect: 1.73, kind: 'Landmark' },
  { slug: 'samsung', name: 'Samsung', aspect: 5.899, kind: 'Smartphones & tech' },
  { slug: 'tesla', name: 'Tesla', aspect: 1.0, kind: 'Automotive' },
  { slug: 'adidas', name: 'adidas', aspect: 1.574, kind: 'Sportswear' },
  { slug: 'playstation', name: 'PlayStation', aspect: 1.269, kind: 'Gaming' },
  { slug: 'byd', name: 'BYD', aspect: 4.798, kind: 'Automotive' },
  { slug: 'dji', name: 'DJI', aspect: 1.672, kind: 'Drones & cameras' },
  { slug: 'huawei', name: 'Huawei', aspect: 1.319, kind: 'Smartphones' },
  { slug: 'xiaomi', name: 'Xiaomi', aspect: 1.0, kind: 'Smartphones' },
  { slug: 'hyatt', name: 'Hyatt', aspect: 3.889, kind: 'Hotels' },
  { slug: 'xpeng', name: 'XPENG', aspect: 7.292, kind: 'Automotive' },
  { slug: 'airasia', name: 'AirAsia', aspect: 1.0, kind: 'Airline' },
  { slug: 'insta360', name: 'Insta360', aspect: 0.981, kind: 'Cameras' },
  { slug: 'honor', name: 'HONOR', aspect: 4.8, kind: 'Smartphones' },
]
