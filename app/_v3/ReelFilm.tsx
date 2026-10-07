'use client'

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// 👉 The motion-reel landing's film: a 30-second motion-graphics introduction
// played in the browser, not a video file, so every figure in it is live.
//
// How it runs: every moving part is a plain CSS animation, held paused, with
// its start written as an animation-delay on the 30 s timeline. One clock
// (requestAnimationFrame) sets each animation's currentTime, so the whole film
// plays, pauses and scrubs as one — like an editor's playhead. Counters and the
// HUD read the same clock. Only transform, opacity and clip-path animate.
//
// Accessibility: autoplay only when motion is allowed and the film is on
// screen; it pauses when scrolled away or the tab is hidden. Under reduced
// motion it rests on the end card and plays only if the visitor presses Play.
// Every fact in the film is repeated in the page below it.

export type ReelPost = {
  id: string
  thumb: string
  reach: number
  permalink?: string
  label: string
  crop?: number
  /** Showcase tiles below the two-year median keep their number to themselves. */
  showReach?: boolean
}
export type ReelBrand = { slug: string; name: string; w: number; h: number }
export type ReelData = {
  followers: number
  reach: number
  views: number
  /** Instagram's total of likes, comments, saves and shares over `period` days. */
  interactions: number
  /** 90 = views and interactions over 90 days, reach = best 30-day window; 30 = the last 30 days. */
  period: 30 | 90
  posts: ReelPost[]
  /** The Work chapter's line — the showcase spans two years, the fallback only recent posts. */
  workTitle?: string
  intro?: { chips: string[]; line: string }
  brands: ReelBrand[]
  email: string
  ig: string
}

export const LENGTH = 30
// [start, end] in seconds. The cut lands on whole beats so a music bed can follow.
const SCENES: [number, number][] = [
  [0, 4],
  [4, 9],
  [9, 15],
  [15, 21],
  [21, 25.5],
  [25.5, LENGTH],
]
const CHAPTERS = ['Hook', 'Me', 'Reach', 'Work', 'Brands', 'Hello']

const clamp = (n: number) => Math.min(1, Math.max(0, n))
const easeOut = (n: number) => 1 - Math.pow(1 - n, 3)
const compact = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + 'M'
  if (a >= 1_000) return (n / 1_000).toFixed(a >= 100_000 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n))
}
const stamp = (t: number) => {
  const s = Math.floor(t)
  const f = Math.floor((t - s) * 25) // 25 fps timecode
  return `00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
}

/** One animated piece: `a` = keyframes name, `d` = start on the timeline (s), `l` = length (s). */
const at = (a: string, d: number, l = 0.7, extra?: CSSProperties): CSSProperties =>
  ({ animationName: a, animationDelay: `${d}s`, animationDuration: `${l}s`, ...extra }) as CSSProperties

/** Words that rise out of a mask one after another. */
function Words({ text, from, step = 0.09, className }: { text: string; from: number; step?: number; className?: string }) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i) => (
        <Fragment key={i}>
          <span className="rf-mask">
            <span className="rf-a" style={at('rf-rise', from + i * step, 0.75)}>
              {w}
            </span>
          </span>{' '}
        </Fragment>
      ))}
    </span>
  )
}

/** A scene: fades up at its start, out just before its end (the last one holds). */
function Scene({ i, children, className = '' }: { i: number; children: ReactNode; className?: string }) {
  const [s, e] = SCENES[i]
  const last = i === SCENES.length - 1
  return (
    <div className={`rf-scene ${className}`} data-scene={i} aria-hidden={last ? undefined : true}>
      <div className="rf-a rf-fill" style={at('rf-fade', s, 0.35)}>
        <div className={last ? 'rf-fill' : 'rf-a rf-fill'} style={last ? undefined : at('rf-leave', e - 0.45, 0.45)}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ReelFilm({ data }: { data: ReelData }) {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const scrub = useRef<HTMLInputElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const tRef = useRef(LENGTH)
  const raf = useRef(0)
  const autoplayed = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)

  // Draw the film at time t: every animation, counter, readout and the scrubber.
  const apply = useCallback((t: number) => {
    tRef.current = t
    const el = stage.current
    if (!el) return
    for (const a of el.getAnimations({ subtree: true })) {
      a.pause()
      a.currentTime = t * 1000
    }
    el.querySelectorAll<HTMLElement>('[data-scene]').forEach(s => {
      const [a, b] = SCENES[Number(s.dataset.scene)]
      const on = t >= a && (t < b || b === LENGTH)
      s.toggleAttribute('inert', !on)
      s.dataset.on = String(on)
    })
    el.querySelectorAll<HTMLElement>('[data-count]').forEach(c => {
      const to = Number(c.dataset.count)
      const p = easeOut(clamp((t - Number(c.dataset.from)) / 1.6))
      const v = to * p
      c.textContent = c.dataset.unit === 'pct' ? `${Math.round(v)}%` : compact(v)
    })
    if (clock.current) clock.current.textContent = stamp(t)
    if (scrub.current) {
      scrub.current.value = String(t)
      scrub.current.style.setProperty('--p', String(t / LENGTH))
    }
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    setPlaying(false)
  }, [])

  const play = useCallback(
    (from?: number) => {
      cancelAnimationFrame(raf.current)
      let t = from ?? (tRef.current >= LENGTH - 0.05 ? 0 : tRef.current)
      let last = performance.now()
      setPlaying(true)
      const tick = (now: number) => {
        t = Math.min(LENGTH, t + (now - last) / 1000)
        last = now
        apply(t)
        if (t >= LENGTH) return setPlaying(false)
        raf.current = requestAnimationFrame(tick)
      }
      apply(t)
      raf.current = requestAnimationFrame(tick)
    },
    [apply],
  )

  // The animations only exist once data-ready is on the page (until then the
  // static end card shows), so the first draw waits for that render.
  useEffect(() => {
    tRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? LENGTH : 0
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    apply(tRef.current)
    const node = root.current
    let io: IntersectionObserver | undefined
    if (node && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            if (!autoplayed.current && !reduced) {
              autoplayed.current = true
              play(0)
            }
          } else if (!e.isIntersecting || e.intersectionRatio < 0.25) stop()
        },
        { threshold: [0, 0.25, 0.5] },
      )
      io.observe(node)
    }
    const onHide = () => document.hidden && stop()
    document.addEventListener('visibilitychange', onHide)
    // A resize can rebuild CSS animations; redraw so they land on the playhead.
    const onResize = () => apply(tRef.current)
    window.addEventListener('resize', onResize)
    return () => {
      io?.disconnect()
      cancelAnimationFrame(raf.current)
      autoplayed.current = false // a remount (dev Strict Mode) may autoplay again
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('resize', onResize)
    }
  }, [ready, apply, play, stop])

  const { followers, reach, views, interactions, period, posts, brands } = data
  const stats = [
    followers ? { v: followers, l: 'Followers', u: 'n' } : null,
    reach ? { v: reach, l: period === 90 ? 'Accounts reached · best 30 days' : 'Accounts reached · 30 days', u: 'n' } : null,
    views ? { v: views, l: `Views · ${period} days`, u: 'n' } : null,
    interactions ? { v: interactions, l: `Interactions · ${period} days`, u: 'n' } : null,
  ].filter(Boolean) as { v: number; l: string; u: string }[]

  return (
    <div className="rf" ref={root} data-ready={ready || undefined} data-playing={playing || undefined}>
      <div className="rf-stage" ref={stage} role="region" aria-roledescription="motion reel" aria-label="A 30-second introduction to Aereon Wong">
        {/* ---------------------------------------------- photography */}
        <div className="rf-bg" aria-hidden="true">
          <div className="rf-a rf-plate" style={at('rf-plate', 0, 9.2)}>
            <img className="rf-a" src="/img/klcc-merdeka.jpg" alt="" style={at('rf-push', 0, 9.5)} />
          </div>
          <div className="rf-a rf-plate" style={at('rf-plate', 8.6, 13)}>
            <img className="rf-a" src="/img/klcc-sunset.jpg" alt="" style={at('rf-drift', 8.6, 13)} />
          </div>
          <div className="rf-a rf-plate rf-plate-hold" style={at('rf-fade', 21, 0.8)}>
            <img className="rf-a" src="/img/klcc-balloon.jpg" alt="" style={at('rf-push', 21, 9.5)} />
          </div>
          <div className="rf-shade" />
          <div className="rf-grain" />
        </div>

        {/* ---------------------------------------------- viewfinder HUD */}
        <div className="rf-hud" aria-hidden="true">
          <span className="rf-a rf-corner tl" style={at('rf-corner', 0.1, 0.6)} />
          <span className="rf-a rf-corner tr" style={at('rf-corner', 0.18, 0.6)} />
          <span className="rf-a rf-corner bl" style={at('rf-corner', 0.26, 0.6)} />
          <span className="rf-a rf-corner br" style={at('rf-corner', 0.34, 0.6)} />
          <div className="rf-a rf-readout l" style={at('rf-fade', 0.3, 0.5)}>
            <i className="rf-rec" /> REC <span ref={clock}>{stamp(LENGTH)}</span>
          </div>
          <div className="rf-a rf-readout r" style={at('rf-fade', 0.5, 0.5)}>
            KUALA LUMPUR · 3.15°N 101.71°E
          </div>
        </div>

        {/* ---------------------------------------------- 1 · hook */}
        <Scene i={0} className="rf-center">
          <p className="rf-kicker">
            <Words text="Kuala Lumpur · Malaysia" from={0.5} step={0.06} />
          </p>
          <h2 className="rf-huge">
            <Words text="I film what" from={0.9} />
            <br />
            <Words text="Malaysia stops to watch." from={1.25} className="rf-tint" />
          </h2>
        </Scene>

        {/* ---------------------------------------------- 2 · who */}
        <Scene i={1} className="rf-who">
          <div className="rf-a rf-face" style={at('rf-fade', 4.2, 0.5)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rf-a" src="/img/aereon.jpg" alt="" style={at('rf-iris', 4.2, 0.9)} />
          </div>
          <div>
            <p className="rf-kicker">
              <Words text="Hi, I'm" from={4.5} />
            </p>
            <h2 className="rf-name">
              <Words text="Aereon Wong" from={4.7} step={0.12} />
            </h2>
            <ul className="rf-chips">
              {(data.intro?.chips ?? ['Tech', 'Travel', 'Aerial', 'Events']).map((c, i) => (
                <li key={c} className="rf-a" style={at('rf-pop', 5.5 + i * 0.16, 0.5)}>
                  {c}
                </li>
              ))}
            </ul>
            <p className="rf-a rf-line" style={at('rf-rise-soft', 6.4, 0.7)}>
              {data.intro?.line ?? 'Tech and Travel Content Creator. Launches, landmarks, hotels and drone shows — filmed to travel.'}
            </p>
          </div>
        </Scene>

        {/* ---------------------------------------------- 3 · reach */}
        <Scene i={2} className="rf-reach">
          <p className="rf-kicker">
            <Words text={reach || views ? `Last ${period} days on Instagram` : 'On Instagram'} from={9.2} step={0.06} />
          </p>
          <div className="rf-stats">
            {stats.map((s, i) => (
              <div key={s.l} className="rf-a rf-stat" style={at('rf-rise-soft', 9.5 + i * 0.55, 0.6)}>
                <b className="num" data-count={s.v} data-from={9.5 + i * 0.55}>
                  {compact(s.v)}
                </b>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
          {reach || views || interactions ? (
            <p className="rf-a rf-fine" style={at('rf-fade', 12.6, 0.6)}>
              {period === 90
                ? 'Instagram’s own account figures. Views and interactions over 90 days; reach is the best 30-day window, as Instagram counts people per window.'
                : 'Reach, views and interactions are Instagram’s own 30-day account figures.'}
            </p>
          ) : null}
        </Scene>

        {/* ---------------------------------------------- 4 · work */}
        <Scene i={3} className="rf-work">
          <p className="rf-kicker">
            <Words text={data.workTitle ?? 'Recent work that travelled'} from={15.2} step={0.07} />
          </p>
          {posts.length ? null : (
            <p className="rf-a rf-line" style={at('rf-rise-soft', 15.6, 0.7)}>
              Launches, landmarks and drone shows — new every week on @aereonwong.
            </p>
          )}
          <div className="rf-a rf-fan" style={at('rf-slide', 15.2, 5.8)}>
            {posts.slice(0, 5).map((p, i) => (
              <figure
                key={p.id}
                className="rf-a rf-card"
                style={at('rf-deal', 15.5 + i * 0.18, 0.8, { ['--r' as string]: `${(i - 2) * 4}deg`, ['--i' as string]: i })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" style={p.crop ? { transform: `scale(${p.crop})` } : undefined} />
                <figcaption>
                  {p.showReach === false ? null : (
                    <>
                      <b className="num">{compact(p.reach)}</b> reached
                    </>
                  )}
                  <span>{p.label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Scene>

        {/* ---------------------------------------------- 5 · brands */}
        <Scene i={4} className="rf-brands">
          <p className="rf-kicker">
            <Words text="Brands I've made work for" from={21.2} step={0.06} />
          </p>
          <ul className="rf-logos">
            {brands.map((b, i) => (
              <li key={b.slug} className="rf-a" style={at('rf-pop', 21.5 + i * 0.07, 0.5)}>
                <span className="rf-logo" style={{ ['--logo' as string]: `url(/img/brands/${b.slug}.svg)`, width: b.w, height: b.h }} />
              </li>
            ))}
          </ul>
        </Scene>

        {/* ---------------------------------------------- 6 · hello */}
        <Scene i={5} className="rf-center rf-end">
          <h2 className="rf-huge">
            <Words text="Let's make something" from={25.8} />
            <br />
            <Words text="that travels." from={26.2} className="rf-tint" />
          </h2>
          <div className="rf-a rf-ctas" style={at('rf-rise-soft', 27, 0.7)}>
            <a className="rf-btn solid" href={`mailto:${data.email}?subject=Collaboration`}>
              Work with me
            </a>
            <a className="rf-btn ghost" href={data.ig} target="_blank" rel="noopener noreferrer">
              @aereonwong
            </a>
          </div>
          <p className="rf-a rf-fine" style={at('rf-fade', 27.6, 0.6)}>
            Tech · Travel · Aerial · Hotels · Events — Kuala Lumpur and wherever the brief goes.
          </p>
        </Scene>
      </div>

      {/* ---------------------------------------------- transport */}
      <div className="rf-bar">
        <button
          type="button"
          className="rf-play"
          onClick={() => {
            autoplayed.current = true
            if (playing) stop()
            else play()
          }} aria-label={playing ? 'Pause reel' : 'Play reel'}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          )}
        </button>
        <div className="rf-track">
          <input
            ref={scrub}
            type="range"
            min={0}
            max={LENGTH}
            step={0.04}
            defaultValue={LENGTH}
            aria-label="Reel position"
            onInput={e => {
              autoplayed.current = true // the visitor took the controls; don't jump back to 0
              stop()
              apply(Number((e.target as HTMLInputElement).value))
            }}
          />
          <ol className="rf-chapters">
            {SCENES.map(([s], i) => (
              <li key={i} style={{ ['--x' as string]: s / LENGTH }}>
                <button
                  type="button"
                  onClick={() => {
                    autoplayed.current = true
                    stop()
                    apply(s + 0.01)
                    play(s + 0.01)
                  }}
                >
                  {CHAPTERS[i]}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <span className="rf-len num">0:{LENGTH}</span>
      </div>
    </div>
  )
}
