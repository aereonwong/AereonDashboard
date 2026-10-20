// 👉 Voice-over recipe — Aereon's cloned voice, as tuned by ear on 19 Oct 2026.
// The /voice page sends text from the browser straight to VoiceStudio on Aereon's Mac
// (127.0.0.1:3900); nothing goes through our server. This file holds the settings and the
// pure audio maths (WAV read/write, silence trim, volume match, stitch) so they can be tested.
//
// Why the intro is generated on its own: "Hey guys, Aereon Wong here!" came out rushed at the
// body's speed. At 0.85 it sounded robotic; 0.88 was "perfect". A "..." inside the intro
// broke its energy, so pauses there become commas.

export const VOICESTUDIO = 'http://127.0.0.1:3900'

export const RECIPE = {
  profileId: '11673efe', // "Aereon Wong v3" — clean 20 s read; never the old rambly 5a9190cd
  introSpeed: 0.88,
  bodySpeed: 0.92,
  steps: 32,
  gap: 0.22, // seconds of silence between intro and body
  language: 'en',
} as const

export const MAX_TAKES = 3

// First sentence = intro; the rest = body. A script with one sentence is all intro.
export function splitScript(script: string): { intro: string; body: string } {
  const text = script.replace(/\s+/g, ' ').trim()
  if (!text) return { intro: '', body: '' }
  // A sentence ends at . ! ? (one or more) followed by a space — but not at "..." mid-thought
  // like "at sunrise... So", which is a pause, not an end.
  const m = text.match(/^(.+?(?:[!?]+|(?<!\.)\.(?!\.)))\s+(.+)$/)
  const intro = (m ? m[1] : text).replace(/\s*(\.{2,}|…)\s*/g, ', ').replace(/,\s*,/g, ',').trim()
  return { intro, body: m ? m[2].trim() : '' }
}

// ---------------------------------------------------------------- WAV in / out (mono)

export type Pcm = { samples: Float32Array; sampleRate: number }

export function readWav(buf: ArrayBuffer): Pcm {
  const v = new DataView(buf)
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file')
  let fmt = 0, channels = 1, sampleRate = 0, bits = 16
  let off = 12
  while (off + 8 <= v.byteLength) {
    const id = tag(off), size = v.getUint32(off + 4, true), body = off + 8
    if (id === 'fmt ') {
      fmt = v.getUint16(body, true)
      channels = v.getUint16(body + 2, true)
      sampleRate = v.getUint32(body + 4, true)
      bits = v.getUint16(body + 14, true)
      if (fmt === 0xfffe) fmt = v.getUint16(body + 24, true) // WAVE_FORMAT_EXTENSIBLE: real format in the GUID
    } else if (id === 'data') {
      const end = Math.min(body + size, v.byteLength)
      const step = bits / 8
      const frames = Math.floor((end - body) / (step * channels))
      const out = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        let s = 0
        for (let c = 0; c < channels; c++) {
          const p = body + (i * channels + c) * step
          s += fmt === 3 ? v.getFloat32(p, true) : bits === 16 ? v.getInt16(p, true) / 32768 : bits === 32 ? v.getInt32(p, true) / 2147483648 : (v.getUint8(p) - 128) / 128
        }
        out[i] = s / channels
      }
      if (!sampleRate) throw new Error('WAV has no format chunk')
      return { samples: out, sampleRate }
    }
    off = body + size + (size % 2)
  }
  throw new Error('WAV has no audio data')
}

export function writeWav({ samples, sampleRate }: Pcm): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const put = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  put(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); put(8, 'WAVE')
  put(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  put(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true)
  }
  return buf
}

// ---------------------------------------------------------------- level + trim + stitch

export function rms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return samples.length ? Math.sqrt(sum / samples.length) : 0
}

// Cut silence (below thresholdDb, in 10 ms windows) off both ends, keeping a short tail.
export function trimSilence(samples: Float32Array, sampleRate: number, thresholdDb = -40): Float32Array {
  const win = Math.max(1, Math.round(sampleRate / 100))
  const floor = 10 ** (thresholdDb / 20)
  const loud = (i: number) => rms(samples.subarray(i, Math.min(samples.length, i + win))) > floor
  let a = 0
  while (a < samples.length && !loud(a)) a += win
  let b = samples.length
  while (b > a && !loud(Math.max(a, b - win))) b -= win
  if (a >= b) return samples.subarray(0, 0)
  const keep = Math.round(sampleRate * 0.03) // 30 ms either side, so words don't clip
  return samples.subarray(Math.max(0, a - keep), Math.min(samples.length, b + keep))
}

// Join parts with a gap. Every part is trimmed and volume-matched to the LAST one (the body),
// so a louder intro doesn't jump out. All parts must share one sample rate.
export function stitch(parts: Pcm[], gap: number = RECIPE.gap): Pcm {
  if (!parts.length) throw new Error('Nothing to stitch')
  const sampleRate = parts[0].sampleRate
  if (parts.some(p => p.sampleRate !== sampleRate)) throw new Error('Parts have different sample rates')
  const trimmed = parts.map(p => trimSilence(p.samples, sampleRate)).filter(s => s.length)
  if (!trimmed.length) return { samples: new Float32Array(0), sampleRate }
  const target = rms(trimmed[trimmed.length - 1])
  const gapLen = Math.round(gap * sampleRate)
  const out = new Float32Array(trimmed.reduce((n, s) => n + s.length, 0) + gapLen * (trimmed.length - 1))
  let at = 0
  trimmed.forEach((s, i) => {
    const level = rms(s)
    const g = level > 0 && target > 0 ? target / level : 1
    for (let k = 0; k < s.length; k++) out[at + k] = s[k] * g
    at += s.length + (i < trimmed.length - 1 ? gapLen : 0)
  })
  return { samples: out, sampleRate }
}

// ---------------------------------------------------------------- auto-check (20 Oct 2026)
// Every part of a take is read back by VoiceStudio's speech-to-text and measured. A take
// passes only when all of CHECK holds, so Aereon listens to passes only. Same rules as
// ~/Desktop/VoiceStudio/tools/check.py. Numbers can't tell whether it SOUNDS like Aereon.

export const CHECK = {
  match: 0.85, // share of script words heard back
  pace: [2.2, 4.5] as const, // words a second of speech — good takes measured 3.1–3.7 (20 Oct 2026)
  paceMinWords: 8, // shorter lines swing too much on one long name to judge pace
  pause: 1.2, // longest silence inside a part, seconds
  peak: -0.5, // loudest sample, dBFS — above this it clips
}

// Names the voice must say right. `say` = how to spell it for the voice (sent instead of the
// name); `heard` = how the speech-to-text writes it when it IS said right — it hears a good
// "Aereon" as "Arian", so that counts. A name not heard as one of these fails the take.
export const BRANDS: { name: string; say?: string; heard: string[] }[] = [
  { name: 'Aereon', heard: ['aereon', 'arian', 'arion', 'aerion', 'erion', 'ariane'] },
  { name: 'KLCC', say: 'K-L-C-C', heard: ['klcc', 'k l c c', 'klc c', 'kl cc'] },
  { name: 'Kuala Lumpur', heard: ['kuala lumpur'] },
]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const word = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(s)}(?![\\p{L}\\p{N}])`, 'giu')

// The text the voice is given: brand names swapped for their spoken spelling.
export function sayAs(text: string, brands = BRANDS): string {
  return brands.reduce((t, b) => (b.say ? t.replace(word(b.name), b.say) : t), text)
}

const NUMS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ')

// Lower-case words with each brand (any of its spellings) folded into one token.
export function wordsOf(text: string, brands = BRANDS): string[] {
  let t = ` ${text.toLowerCase()} `
  brands.forEach((b, i) => {
    for (const s of [b.name.toLowerCase(), ...(b.say ? [b.say.toLowerCase()] : []), ...b.heard].sort((x, y) => y.length - x.length))
      t = t.replace(word(s), ` brand${i} `)
  })
  return (t.match(/[\p{L}\p{N}']+/gu) ?? []).map(w => (/^\d+$/.test(w) && +w <= 20 ? NUMS[+w] : w.replace(/'/g, '')))
}

// 2 × (words in common, in order) ÷ (both lengths) — difflib's ratio, via longest common subsequence.
export function matchRatio(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1
  let prev = new Array(b.length + 1).fill(0)
  for (const x of a) {
    const row = [0]
    for (let j = 0; j < b.length; j++) row.push(x === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], row[j]))
    prev = row
  }
  return (2 * prev[b.length]) / (a.length + b.length)
}

// Speech length (silence off both ends), longest pause inside, loudest peak — 10 ms windows, -35 dB.
export function measure({ samples, sampleRate }: Pcm) {
  const win = Math.max(1, Math.round(sampleRate / 100))
  const floor = 10 ** (-35 / 20)
  const loud: boolean[] = []
  for (let i = 0; i < samples.length; i += win) loud.push(rms(samples.subarray(i, i + win)) > floor)
  const first = loud.indexOf(true), last = loud.lastIndexOf(true)
  let longest = 0, run = 0
  for (let i = first; first >= 0 && i <= last; i++) { run = loud[i] ? 0 : run + 1; longest = Math.max(longest, run) }
  let peak = 0
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
  return {
    seconds: samples.length / sampleRate,
    speech: first < 0 ? 0 : ((last - first + 1) * win) / sampleRate,
    longestPause: (longest * win) / sampleRate,
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
  }
}

export type Verdict = { pass: boolean; fails: string[]; match: number; pace: number; heard: string }

export function judge(script: string, heard: string, pcm: Pcm, brands = BRANDS): Verdict {
  const want = wordsOf(script, brands), got = wordsOf(heard, brands)
  const m = measure(pcm)
  const match = matchRatio(want, got)
  const pace = m.speech > 0 ? script.trim().split(/\s+/).length / m.speech : 0
  const count = (list: string[], t: string) => list.filter(w => w === t).length
  const missed = brands.filter((_, i) => count(want, `brand${i}`) > count(got, `brand${i}`)).map(b => b.name)
  const fails: string[] = []
  if (match < CHECK.match) fails.push(`only ${Math.round(match * 100)}% of words heard back`)
  if (missed.length) fails.push(`${missed.join(', ')} said wrong`)
  if (want.length >= CHECK.paceMinWords && (pace < CHECK.pace[0] || pace > CHECK.pace[1])) fails.push(`pace ${pace.toFixed(1)} words/s`)
  if (m.longestPause > CHECK.pause) fails.push(`${m.longestPause.toFixed(1)} s pause`)
  if (m.peakDb > CHECK.peak) fails.push('clipping')
  return { pass: !fails.length, fails, match, pace, heard }
}
