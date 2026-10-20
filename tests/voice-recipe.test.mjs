// Unit tests for the voice-over recipe (lib/voice-recipe.ts). Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readWav, rms, splitScript, stitch, trimSilence, writeWav } from '../lib/voice-recipe.ts'

const SR = 24000
const tone = (secs, amp) => Float32Array.from({ length: Math.round(secs * SR) }, (_, i) => amp * Math.sin(i / 5))
const cat = (...a) => { const o = new Float32Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length } return o }

test('first sentence is the intro, the rest is the body', () => {
  assert.deepEqual(splitScript('Hey guys, Aereon Wong here! Today we fly. Let\'s GO!'), {
    intro: 'Hey guys, Aereon Wong here!', body: 'Today we fly. Let\'s GO!',
  })
  assert.deepEqual(splitScript('  Just one line.  '), { intro: 'Just one line.', body: '' })
  assert.deepEqual(splitScript(''), { intro: '', body: '' })
})

test('a pause in the intro becomes a comma; a "..." is not a sentence end', () => {
  assert.equal(splitScript('Hey guys... Aereon Wong here! Go.').intro, 'Hey guys, Aereon Wong here!')
  assert.deepEqual(splitScript('Hey! Over KL at sunrise... So, let\'s GO!'), { intro: 'Hey!', body: 'Over KL at sunrise... So, let\'s GO!' })
})

test('WAV round-trips through 16-bit PCM', () => {
  const s = tone(0.1, 0.5)
  const back = readWav(writeWav({ samples: s, sampleRate: SR }))
  assert.equal(back.sampleRate, SR)
  assert.equal(back.samples.length, s.length)
  assert.ok(Math.abs(back.samples[100] - s[100]) < 1e-3)
})

test('silence is trimmed from both ends, keeping a 30 ms tail', () => {
  const s = cat(new Float32Array(SR / 2), tone(1, 0.3), new Float32Array(SR / 2))
  const t = trimSilence(s, SR)
  assert.ok(t.length >= SR && t.length <= SR + 0.07 * SR, `got ${t.length}`)
  assert.equal(trimSilence(new Float32Array(SR), SR).length, 0)
})

test('stitch matches each part to the body\'s level and adds the gap', () => {
  const intro = { samples: tone(1, 0.8), sampleRate: SR }
  const body = { samples: tone(2, 0.2), sampleRate: SR }
  const out = stitch([intro, body], 0.22)
  const gap = Math.round(0.22 * SR)
  assert.ok(Math.abs(out.samples.length - (3 * SR + gap)) < 0.08 * SR)
  const introPart = out.samples.subarray(0, SR - 1000)
  assert.ok(Math.abs(rms(introPart) / rms(body.samples) - 1) < 0.05, 'intro level matches body')
  assert.throws(() => stitch([intro, { samples: tone(1, 0.2), sampleRate: 44100 }]))
})

import { judge, matchRatio, measure, sayAs, wordsOf } from '../lib/voice-recipe.ts'

test('brands are spelled for the voice and folded when read back', () => {
  assert.equal(sayAs('Over KLCC and klcc park'), 'Over K-L-C-C and K-L-C-C park')
  assert.equal(sayAs('KLCCX stays'), 'KLCCX stays')
  assert.deepEqual(wordsOf('Hey guys, Arian Wong here.'), wordsOf('Hey guys, Aereon Wong here!'))
  assert.deepEqual(wordsOf('over K-L-C-C'), wordsOf('over KLCC'))
  assert.deepEqual(wordsOf('3 drones'), ['three', 'drones'])
})

test('match ratio follows difflib', () => {
  assert.equal(matchRatio(['a', 'b'], ['a', 'b']), 1)
  assert.equal(matchRatio(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd']), 0.75)
  assert.equal(matchRatio([], []), 1)
})

test('measure finds speech length and the longest inner pause', () => {
  const m = measure({ samples: cat(new Float32Array(SR / 2), tone(1, 0.3), new Float32Array(SR * 1.5), tone(1, 0.3), new Float32Array(SR / 4)), sampleRate: SR })
  assert.ok(Math.abs(m.speech - 3.5) < 0.05, `speech ${m.speech}`)
  assert.ok(Math.abs(m.longestPause - 1.5) < 0.05, `pause ${m.longestPause}`)
  assert.ok(m.peakDb < -10 && m.peakDb > -11)
})

test('a take with the name misheard fails; a good one passes', () => {
  const pcm = { samples: tone(1.8, 0.3), sampleRate: SR }
  const ok = judge('Hey guys, Aereon Wong here!', 'Hey guys, Arian Wong here.', pcm)
  assert.equal(ok.pass, true, ok.fails.join())
  const bad = judge('Hey guys, Aereon Wong here!', 'Hey guys, everyone wrong here.', pcm)
  assert.equal(bad.pass, false)
  assert.ok(bad.fails.some(f => f.includes('Aereon said wrong')))
  assert.ok(judge('Hey guys, Aereon Wong here!', 'Hey guys, Arian Wong here.', { samples: tone(1.8, 1), sampleRate: SR }).fails.includes('clipping'))
  assert.equal(judge('Hey guys, Aereon Wong here!', 'Hey guys, Arian Wong here.', { samples: tone(1.1, 0.3), sampleRate: SR }).pass, true, 'short line: pace not judged')
  const long = 'Today we are flying the drone over the towers at sunrise'
  assert.ok(judge(long, long, { samples: tone(1.5, 0.3), sampleRate: SR }).fails.some(f => f.startsWith('pace')))
})
