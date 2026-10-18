// 👉 Voice-over — scripts in Aereon's cloned voice, made by VoiceStudio on Aereon's Mac.
// Everything happens in the browser (app/_v3/pages/VoiceOver.tsx); this route only frames it.
import { readVersion } from '@/lib/v3/version'
import V3VoiceOver from '@/app/_v3/pages/VoiceOver'
import '@/app/_v3/v3.css'
import './voice.css'
import { v3Fonts } from '@/app/_v3/fonts'

export const dynamic = 'force-dynamic'

export default async function Voice() {
  const { version } = await readVersion()
  const page = <V3VoiceOver />
  return version === 'v3' ? page : <div className={`v3 ${v3Fonts}`} data-world="canon">{page}</div>
}
