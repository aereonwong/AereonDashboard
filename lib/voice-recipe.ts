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
