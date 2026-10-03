import { cookies } from 'next/headers'

// 👉 Which version of the app to draw.
//
// Three dashboard versions live side by side and are chosen per device in
// Settings, in a cookie so the server can read the choice before it draws:
//   · v1 — the original creator view
//   · v2 — the operating picture
//   · v3 — the creator studio, a whole-app redesign in Studio Standard (the default
//     since 2 Oct 2026 — the version Aereon works on). Its other worlds, Contact
//     Sheet and Flight HUD, were removed on 3 Oct 2026.

import { type Version, type World } from './catalog'
export { VERSIONS, WORLDS, type Version, type World } from './catalog'

const isVersion = (v: string | undefined): v is Version => v === 'v1' || v === 'v2' || v === 'v3'

/** The version this device asked for. Anything unrecognised means v3. */
export async function readVersion(): Promise<{ version: Version; world: World }> {
  try {
    const jar = await cookies()
    const v = jar.get('cfo-dash')?.value
    return { version: isVersion(v) ? v : 'v3', world: 'canon' } // one look; an old cfo-v3 cookie is ignored
  } catch {
    return { version: 'v3', world: 'canon' }
  }
}
