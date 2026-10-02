import { cookies } from 'next/headers'

// 👉 Which version of the app to draw, and in which visual world.
//
// Three dashboard versions live side by side and are chosen per device in
// Settings, in a cookie so the server can read the choice before it draws:
//   · v1 — the original creator view
//   · v2 — the operating picture
//   · v3 — the creator studio, a whole-app redesign in one of three worlds (the default
//     since 2 Oct 2026, in Studio Standard — the version Aereon works on)
//
// v3's worlds share one structure, one data layer and one filter model. They
// differ in material, type and motion, never in what the numbers are.

import { type Version, type World } from './catalog'
export { VERSIONS, WORLDS, type Version, type World } from './catalog'

const isVersion = (v: string | undefined): v is Version => v === 'v1' || v === 'v2' || v === 'v3'
const isWorld = (w: string | undefined): w is World => w === 'contact' || w === 'hud' || w === 'canon'

/** The version and world this device asked for. Anything unrecognised means v3 in Studio Standard. */
export async function readVersion(): Promise<{ version: Version; world: World }> {
  try {
    const jar = await cookies()
    const v = jar.get('cfo-dash')?.value
    const w = jar.get('cfo-v3')?.value
    return { version: isVersion(v) ? v : 'v3', world: isWorld(w) ? w : 'canon' }
  } catch {
    return { version: 'v3', world: 'canon' }
  }
}
