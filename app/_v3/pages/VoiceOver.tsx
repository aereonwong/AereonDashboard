'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_TAKES, RECIPE, VOICESTUDIO, judge, readWav, sayAs, splitScript, stitch, writeWav, type Verdict } from '@/lib/voice-recipe'

// 👉 v3 Voice-over: type a script, get it back in Aereon's cloned voice.
// The browser talks straight to VoiceStudio on this Mac (127.0.0.1:3900) — our server never
// sees the script or the audio. VoiceStudio only answers sites on its allowed list
// (OMNIVOICE_ALLOWED_ORIGINS), so on any other computer, or with the app closed, this page
// says so instead of generating. The recipe (speeds, steps, intro split) is lib/voice-recipe.ts.
// With "Check each take" on, every part is read back by VoiceStudio's speech-to-text and measured
// (judge() in the same file); takes that fail are folded away with the reason.

type Status = 'checking' | 'ready' | 'offline'
type Profile = { id: string; name: string }
type Take = { n: number; url: string; seconds: number; checked: boolean; pass: boolean; fails: string[]; heard: string }

const SAMPLE = "Hey guys, Aereon Wong here! Today we're flying the drone over Kuala Lumpur at sunrise... So, let's GO!"

async function generate(text: string, profileId: string, speed: number, steps: number, signal: AbortSignal) {
  const form = new FormData()
  form.set('text', sayAs(text))
  form.set('language', RECIPE.language)
  form.set('profile_id', profileId)
  form.set('speed', String(speed))
  form.set('num_step', String(steps))
  const r = await fetch(`${VOICESTUDIO}/generate`, { method: 'POST', body: form, signal })
  if (!r.ok) throw new Error(`VoiceStudio said ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return readWav(await r.arrayBuffer())
}

// VoiceStudio's speech-to-text, on the take we just made — still on this Mac.
async function transcribe(wav: ArrayBuffer, signal: AbortSignal) {
  const form = new FormData()
  form.set('audio', new Blob([wav], { type: 'audio/wav' }), 'take.wav')
  form.set('language', RECIPE.language)
  const r = await fetch(`${VOICESTUDIO}/transcribe`, { method: 'POST', body: form, signal })
  if (!r.ok) throw new Error(`read-back ${r.status}`)
  return String(((await r.json()) as { text?: string }).text ?? '')
}

// Local time, e.g. 20261019-0314, so downloads sort in the order they were made.
const stamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export default function VoiceOver() {
  const [status, setStatus] = useState<Status>('checking')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState<string>(RECIPE.profileId)
  const [script, setScript] = useState(SAMPLE)
  const [split, setSplit] = useState(true)
  const [checkTakes, setCheckTakes] = useState(true)
  const [takes, setTakes] = useState(2)
  const [introSpeed, setIntroSpeed] = useState<number>(RECIPE.introSpeed)
  const [bodySpeed, setBodySpeed] = useState<number>(RECIPE.bodySpeed)
  const [steps, setSteps] = useState<number>(RECIPE.steps)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Take[]>([])
  const abort = useRef<AbortController | null>(null)

  const check = useCallback(async () => {
    setStatus('checking')
    try {
      const h = await fetch(`${VOICESTUDIO}/health`, { cache: 'no-store' })
      if (!h.ok) throw new Error()
      const list = (await (await fetch(`${VOICESTUDIO}/profiles`, { cache: 'no-store' })).json()) as Profile[]
      setProfiles(list.map(p => ({ id: p.id, name: p.name })))
      setProfileId(id => (list.some(p => p.id === id) ? id : list[0]?.id ?? id))
      setStatus('ready')
    } catch {
      setStatus('offline')
    }
  }, [])
  useEffect(() => { check() }, [check])
  // Free the audio blobs when the page goes away.
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach(u => URL.revokeObjectURL(u)), [])

  const parts = split ? splitScript(script) : { intro: script.replace(/\s+/g, ' ').trim(), body: '' }
  const canGo = status === 'ready' && !busy && parts.intro.length > 0

  const run = async () => {
    const ctl = new AbortController()
    abort.current = ctl
    setError(null)
    try {
      for (let n = 1; n <= takes; n++) {
        const tag = takes > 1 ? `Take ${n} of ${takes}` : 'Generating'
        setBusy(`${tag} · ${parts.body ? 'intro' : 'script'}…`)
        const texts = parts.body ? [parts.intro, parts.body] : [parts.intro]
        const pieces = []
        const verdicts: Verdict[] = []
        let checked = checkTakes
        for (const [i, text] of texts.entries()) {
          const what = parts.body ? (i ? 'body' : 'intro') : 'script'
          if (i) setBusy(`${tag} · ${what}…`)
          const pcm = await generate(text, profileId, parts.body && !i ? introSpeed : bodySpeed, steps, ctl.signal)
          pieces.push(pcm)
          if (!checked) continue
          setBusy(`${tag} · checking ${what}…`)
          try {
            verdicts.push(judge(text, await transcribe(writeWav(pcm), ctl.signal), pcm))
          } catch (e) {
            if (ctl.signal.aborted) throw e
            checked = false // read-back not available — keep the take, unchecked
          }
        }
        const out = stitch(pieces)
        const url = URL.createObjectURL(new Blob([writeWav(out)], { type: 'audio/wav' }))
        urls.current.push(url)
        const take = {
          n, url, seconds: out.samples.length / out.sampleRate, checked,
          pass: !checked || verdicts.every(v => v.pass),
          fails: checked ? verdicts.flatMap((v, i) => v.fails.map(f => (texts.length > 1 ? `${i ? 'Body' : 'Intro'}: ${f}` : f))) : [],
          heard: verdicts.map(v => v.heard).join(' '),
        }
        setResults(r => [take, ...r])
      }
    } catch (e) {
      if (!ctl.signal.aborted) {
        setError(e instanceof TypeError ? 'Lost VoiceStudio mid-way — is the app still open?' : (e as Error).message)
        check()
      }
    } finally {
      setBusy(null)
      abort.current = null
    }
  }

  const passed = results.filter(t => t.pass), failed = results.filter(t => !t.pass)

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Voice-over</h1>
          <p className="v3-lede">
            Your script in your cloned voice, made by VoiceStudio on this Mac. The script and audio never leave
            this computer until you download them.
          </p>
        </div>
        <span className={`vo-status is-${status}`} role="status">
          <i aria-hidden="true" />
          {status === 'checking' ? 'Looking for VoiceStudio…' : status === 'ready' ? 'VoiceStudio connected' : 'VoiceStudio not reachable'}
        </span>
      </header>

      <div className="v3-grid">
        {status === 'offline' ? (
          <section className="v3-panel v3-span-12 vo-offline" aria-labelledby="vo-off">
            <h2 className="v3-panel-title" id="vo-off">Can&apos;t reach VoiceStudio</h2>
            <ol>
              <li>This page only works on the Mac that runs VoiceStudio, in Chrome (Safari blocks it).</li>
              <li>Open the VoiceStudio app and wait until it says it&apos;s ready.</li>
              <li>If it&apos;s open and this still shows, VoiceStudio hasn&apos;t been told to trust aereonwong.com — see <code>~/Desktop/VoiceStudio/RECIPE.md</code>.</li>
              <li>If Chrome asked to allow access to devices on your local network, choose Allow.</li>
            </ol>
            <button className="v3-btn" type="button" onClick={check}>Try again</button>
          </section>
        ) : null}

        <section className="v3-panel v3-span-8" aria-labelledby="vo-script">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="vo-script">Script</h2>
            <p className="v3-panel-note">{script.trim() ? `${script.trim().split(/\s+/).length} words` : 'Empty'}</p>
          </div>
          <label className="v3-field">
            <span>What should you say?</span>
            <textarea className="v3-input vo-text" rows={7} value={script} onChange={e => setScript(e.target.value)} maxLength={4000} />
          </label>
          <p className="vo-hint">
            Tone comes from punctuation: <b>,</b> a breath · <b>...</b> a pause · <b>!</b> lifts the energy · CAPS stresses a word (&ldquo;let&apos;s GO!&rdquo;).
            Write it the way you talk.
          </p>
          {split && parts.body ? (
            <dl className="vo-split">
              <div><dt>Intro · speed {introSpeed}</dt><dd>{parts.intro}</dd></div>
              <div><dt>Body · speed {bodySpeed}</dt><dd>{parts.body}</dd></div>
            </dl>
          ) : null}
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="vo-set">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="vo-set">Settings</h2>
          </div>
          <div className="vo-stack">
            <label className="v3-field">
              <span>Voice</span>
              <select className="v3-select vo-wide" value={profileId} onChange={e => setProfileId(e.target.value)} disabled={!profiles.length}>
                {profiles.length ? profiles.map(p => <option key={p.id} value={p.id}>{p.name}{p.id === RECIPE.profileId ? ' (tuned)' : ''}</option>) : <option value={profileId}>Aereon Wong v3</option>}
              </select>
            </label>
            <div className="v3-field">
              <span>Takes — each one comes out a little different</span>
              <div className="v3-seg" role="group" aria-label="Takes">
                {Array.from({ length: MAX_TAKES }, (_, i) => i + 1).map(n => (
                  <button key={n} type="button" aria-pressed={takes === n} onClick={() => setTakes(n)}>{n}</button>
                ))}
              </div>
            </div>
            <label className="vo-check">
              <input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} />
              Slower intro (first sentence on its own)
            </label>
            <label className="vo-check">
              <input type="checkbox" checked={checkTakes} onChange={e => setCheckTakes(e.target.checked)} />
              Check each take (read back, keep passes)
            </label>
            <details className="vo-more">
              <summary>Fine-tune</summary>
              <div className="vo-nums">
                <label className="v3-field"><span>Intro speed</span><input className="v3-input" type="number" min={0.5} max={2} step={0.01} value={introSpeed} onChange={e => setIntroSpeed(Number(e.target.value) || RECIPE.introSpeed)} /></label>
                <label className="v3-field"><span>Body speed</span><input className="v3-input" type="number" min={0.5} max={2} step={0.01} value={bodySpeed} onChange={e => setBodySpeed(Number(e.target.value) || RECIPE.bodySpeed)} /></label>
                <label className="v3-field"><span>Quality steps</span><input className="v3-input" type="number" min={8} max={64} step={8} value={steps} onChange={e => setSteps(Number(e.target.value) || RECIPE.steps)} /></label>
              </div>
              <button className="v3-btn" type="button" onClick={() => { setIntroSpeed(RECIPE.introSpeed); setBodySpeed(RECIPE.bodySpeed); setSteps(RECIPE.steps) }}>Back to tuned settings</button>
            </details>
            <div className="vo-go">
              {busy ? (
                <>
                  <button className="v3-btn" type="button" onClick={() => abort.current?.abort()}>Stop</button>
                  <span className="vo-busy" role="status">{busy}</span>
                </>
              ) : (
                <button className="v3-btn v3-btn-primary" type="button" onClick={run} disabled={!canGo}>
                  Generate {takes > 1 ? `${takes} takes` : 'voice-over'}
                </button>
              )}
            </div>
            {error ? <p className="v3-error">{error}</p> : null}
          </div>
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="vo-out">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="vo-out">Takes</h2>
            <p className="v3-panel-note">Kept until you leave this page — download the ones you want</p>
          </div>
          {results.length ? (
            <>
              {passed.length ? (
                <ul className="vo-takes">{passed.map(t => <TakeRow key={t.url} t={t} />)}</ul>
              ) : (
                <p className="v3-empty">No take passed the check — try again, or reword the line (commas, spelling).</p>
              )}
              {failed.length ? (
                <details className="vo-more vo-failed">
                  <summary>Didn&apos;t pass ({failed.length})</summary>
                  <ul className="vo-takes">{failed.map(t => <TakeRow key={t.url} t={t} />)}</ul>
                </details>
              ) : null}
            </>
          ) : (
            <p className="v3-empty">Nothing yet. A 10-second line takes about a minute at quality settings.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function TakeRow({ t }: { t: Take }) {
  return (
    <li>
      <b>Take {t.n}</b>
      <audio controls src={t.url} preload="metadata" />
      <span className="vo-meta">{t.seconds.toFixed(1)} s</span>
      <a className="v3-btn" href={t.url} download={`aereon-voiceover-${stamp()}-take${t.n}.wav`}>Download</a>
      {t.checked ? (
        <p className="vo-verdict">
          <span className={t.pass ? 'is-pass' : 'is-fail'}>{t.pass ? 'Passed' : t.fails.join(' · ')}</span>
          <span className="vo-heard">Heard: &ldquo;{t.heard}&rdquo;</span>
        </p>
      ) : null}
    </li>
  )
}
