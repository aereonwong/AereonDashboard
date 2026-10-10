'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Lab } from '@/lib/v3/content-lab'
import {
  ANGLES,
  DAYPARTS,
  HOOKS,
  WEEKDAYS,
  concentration,
  group,
  median,
  mytDay,
  months,
  presets,
  pulse,
  slice,
  timeline,
  verdict,
  watchBands,
  when,
  type AngleKey,
  type Filters,
  type Format,
  type HookKey,
  type LabPost,
  type Range,
} from '@/lib/v3/lab-math'
import { compact, longDate, num, shortDate } from '../fmt'
import '../lab.css'

// 👉 v3 Instagram, Content Lab view: what to post next, read from THIS YEAR's posts only
// (from 1 January, Malaysia time — Aereon's choice on 10 Oct 2026; lib/v3/content-lab.ts labSince).
//
// One filter bar scopes the page (timeline · format · angle · hook). A panel that IS one of
// those filters (the hook board, the angle grid) shows all its own options and highlights
// the chosen one; every panel says in its corner which filters it follows. Account figures
// (Instagram's unique-reach windows) only follow the timeline — they cannot be split by post.
//
// Motion: numbers count to their new value, bars grow from their baseline, the verdict
// sets itself word by word. All of it is transform/opacity, and none of it runs under
// prefers-reduced-motion.

const FORMATS: { key: Format; label: string }[] = [
  { key: 'reel', label: 'Reels' },
  { key: 'carousel', label: 'Carousels' },
  { key: 'photo', label: 'Photos' },
]
const fmtLabel = (f: Format) => FORMATS.find(x => x.key === f)!.label.replace(/s$/, '')
const hookMeta = (k: HookKey) => HOOKS.find(h => h.key === k)!
const angleLabel = (k: AngleKey) => ANGLES.find(a => a.key === k)!.label
/** Month entries in the timeline list are keyed YYYY-MM; the presets are words. */
const isMonth = (key: string) => /^\d{4}-\d{2}$/.test(key)
const times = (x: number) => (x >= 10 ? `${x.toFixed(0)}×` : `${x.toFixed(1)}×`)
const pc = (x: number) => `${Math.round(x * 100)}%`
/** SVG coordinates to 0.1 unit: Math.log10 can differ in the last digit between server and browser, which breaks hydration. */
const r1 = (v: number) => Math.round(v * 10) / 10
const rate = (x: number | null) => (x === null ? '—' : x >= 10 ? x.toFixed(0) : x.toFixed(1))
const n0 = (x: number | null) => (x === null ? '—' : num(x))
const c0 = (x: number | null) => (x === null ? '—' : compact(x))

// ------------------------------------------------------------------ motion helpers

function useReducedMotion() {
  const [reduce, set] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    set(q.matches)
    const on = () => set(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return reduce
}

/** A number that eases from its last value to the new one (≈700ms, ease-out-expo). */
function Count({ value, format = num }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 700)
      const e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k)
      const v = a + (value - a) * e
      setShown(v)
      from.current = v
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])
  return <span className="num">{format(shown)}</span>
}

/** The verdict, set word by word. Keyed on its text, so a new slice replays it. */
function Kinetic({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} key={text} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="lab-word" aria-hidden="true" style={{ ['--i' as string]: i }}>
          {w}&nbsp;
        </span>
      ))}
    </span>
  )
}

// ------------------------------------------------------------------ the one tooltip

type Tip = { x: number; y: number; body: ReactNode } | null

function useTip() {
  const [tip, setTip] = useState<Tip>(null)
  // The tooltip is pinned to the screen, so a scroll would leave it floating over the wrong mark.
  useEffect(() => {
    if (!tip) return
    const off = () => setTip(null)
    window.addEventListener('scroll', off, { passive: true, once: true })
    return () => window.removeEventListener('scroll', off)
  }, [tip])
  const show = (e: { clientX: number; clientY: number }, body: ReactNode) => setTip({ x: e.clientX, y: e.clientY, body })
  /** Keyboard focus gets the same tooltip, anchored on the focused mark. */
  const focus = (e: { currentTarget: Element }, body: ReactNode) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ x: r.left + r.width / 2, y: r.top, body })
  }
  return { tip, show, focus, hide: () => setTip(null) }
}

function TipLayer({ tip }: { tip: Tip }) {
  if (!tip) return null
  const right = typeof window !== 'undefined' && tip.x > window.innerWidth - 260
  return (
    <div className="lab-tip" role="tooltip" style={{ left: tip.x, top: tip.y, ['--dx' as string]: right ? '-100%' : '-50%' }}>
      {tip.body}
    </div>
  )
}

function PostTip({ p, typical }: { p: LabPost; typical: number }) {
  const h = hookMeta(p.hookType)
  return (
    <div className="lab-tip-post">
      <div className="lab-tip-hook">{p.hook || '(no caption)'}</div>
      <div className="lab-tip-meta">
        {longDate(mytDay(p.at))} · {fmtLabel(p.format)} · <i className="lab-key" data-hook={h.key} /> {h.short} · {angleLabel(p.angle)}
      </div>
      <div className="lab-tip-nums">
        <span>
          <b>{num(p.reach)}</b> reached
        </span>
        <span>
          <b>{typical ? times(p.reach / typical) : '—'}</b> typical
        </span>
        <span>
          <b>{n0(p.shares)}</b> shares
        </span>
        <span>
          <b>{n0(p.saves)}</b> saves
        </span>
        {p.watchSec !== null ? (
          <span>
            <b>{p.watchSec.toFixed(1)}s</b> watch
          </span>
        ) : null}
        {p.follows ? (
          <span>
            <b>{num(p.follows)}</b> follows
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Which filters a panel follows, said in its corner so no number is a mystery. */
function Scope({ children }: { children: ReactNode }) {
  return <span className="lab-scope">{children}</span>
}

function Panel({ id, title, note, scope, span, children }: { id: string; title: string; note?: string; scope: ReactNode; span: number; children: ReactNode }) {
  return (
    <section className={`v3-panel v3-span-${span} lab-panel`} aria-labelledby={`lab-${id}`}>
      <div className="lab-panel-head">
        <div>
          <h2 className="v3-panel-title" id={`lab-${id}`}>
            {title}
          </h2>
          {note ? <p className="v3-panel-note">{note}</p> : null}
        </div>
        <Scope>{scope}</Scope>
      </div>
      {children}
    </section>
  )
}

// ------------------------------------------------------------------ the page

export default function ContentLab({ lab, username }: { lab: Lab; username: string }) {
  const today = lab.today || (lab.newest ? mytDay(lab.newest) : '')
  const since = lab.since || today.slice(0, 4) + '-01-01'
  const ranges = useMemo(() => [...presets(today, since), ...months(today, since)], [today, since])
  // Opens on the last 90 days (or the year so far, when that is shorter) — Aereon's default.
  const DEFAULT = '90'
  const [preset, setPreset] = useState(DEFAULT)
  const [zoom, setZoom] = useState<{ range: Range; label: string } | null>(null)
  const [format, setFormat] = useState<Format | ''>('')
  const [angle, setAngle] = useState<AngleKey | ''>('')
  const [hook, setHook] = useState<HookKey | ''>('')
  const tips = useTip()

  const range = zoom?.range ?? ranges.find(r => r.key === preset)!.range
  const f: Filters = { range, format, angle, hook }
  const posts = useMemo(() => slice(lab.posts, f), [lab.posts, range.from, range.to, format, angle, hook]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = pulse(posts)

  // The same-length stretch just before, for the "vs before" line under each number.
  const prevRange: Range = useMemo(() => {
    const len = Date.parse(range.to) - Date.parse(range.from) + 86_400_000
    const to = new Date(Date.parse(range.from) - 86_400_000).toISOString().slice(0, 10)
    return { from: new Date(Date.parse(to) - len + 86_400_000).toISOString().slice(0, 10), to }
  }, [range.from, range.to])
  // Before 1 January there is no data in the Lab, so a comparison there would read as a fall to zero.
  const prev = prevRange.from >= since ? pulse(slice(lab.posts, { ...f, range: prevRange })) : null
  const v = verdict(posts)
  const any = format || angle || hook || zoom || preset !== DEFAULT

  if (!lab.posts.length) {
    return (
      <div>
        <header className="v3-head">
          <h1 className="v3-title">Content Lab</h1>
        </header>
        <section className="v3-panel">
          <p className="v3-empty">The Content Lab reads this year's posts from your stored Instagram archive. It has nothing to show in demo mode, or before the first refresh of the year.</p>
        </section>
      </div>
    )
  }

  const rangeLabel = zoom?.label ?? ranges.find(r => r.key === preset)!.label
  return (
    <div className="lab">
      <header className="v3-head lab-head">
        <div>
          <p className="lab-eyebrow">
            Content Lab · @{username} · {rangeLabel}
          </p>
          <h1 className="lab-title">{v ? <Kinetic text={v.lead} /> : <Kinetic text="What travels, and why" />}</h1>
          <p className="v3-lede">
            {v ? v.detail : 'Too few posts in this slice to call a winner — widen the timeline.'} Numbers as of {lab.read ? longDate(lab.read) : 'the last refresh'}.
          </p>
        </div>
      </header>

      {/* ------------------------------------------------ the filters: one row, above everything */}
      <div className="lab-filters" role="toolbar" aria-label="Filter every panel">
        <div className="lab-fgroup">
          <span className="lab-flabel">Timeline</span>
          <div className="v3-seg">
            {ranges.filter(r => !isMonth(r.key)).map(r => (
              <button
                key={r.key}
                type="button"
                aria-pressed={!zoom && preset === r.key}
                onClick={() => {
                  setPreset(r.key)
                  setZoom(null)
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            className="lab-select"
            aria-label="One month"
            value={!zoom && isMonth(preset) ? preset : ''}
            onChange={e => {
              if (!e.target.value) return
              setPreset(e.target.value)
              setZoom(null)
            }}
          >
            <option value="">Pick a month…</option>
            {ranges.filter(r => isMonth(r.key)).map(r => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          {zoom ? (
            <button type="button" className="lab-chip-on" onClick={() => setZoom(null)} aria-label={`Clear ${zoom.label}`}>
              {zoom.label} ✕
            </button>
          ) : null}
        </div>
        <div className="lab-fgroup">
          <span className="lab-flabel">Format</span>
          <div className="v3-seg">
            <button type="button" aria-pressed={!format} onClick={() => setFormat('')}>
              All
            </button>
            {FORMATS.map(x => (
              <button key={x.key} type="button" aria-pressed={format === x.key} onClick={() => setFormat(x.key)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lab-fgroup">
          <label className="lab-flabel" htmlFor="lab-angle">
            Angle
          </label>
          <select id="lab-angle" className="lab-select" value={angle} onChange={e => setAngle(e.target.value as AngleKey | '')}>
            <option value="">Every angle</option>
            {ANGLES.map(a => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <label className="lab-flabel" htmlFor="lab-hook">
            Hook
          </label>
          <select id="lab-hook" className="lab-select" value={hook} onChange={e => setHook(e.target.value as HookKey | '')}>
            <option value="">Every hook</option>
            {HOOKS.map(h => (
              <option key={h.key} value={h.key}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div className="lab-fcount" aria-live="polite">
          <b className="num">{num(posts.length)}</b> posts
          {any ? (
            <button
              type="button"
              className="lab-reset"
              onClick={() => {
                setPreset(DEFAULT)
                setZoom(null)
                setFormat('')
                setAngle('')
                setHook('')
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="v3-grid">
        {/* ------------------------------------------------ pulse */}
        <section className="v3-panel v3-span-12 lab-kpis" aria-label="This slice at a glance">
          <Kpi label="Posts" value={p.posts} prev={prev?.posts ?? null} />
          <Kpi label="Combined reach" value={p.reach} prev={prev?.reach ?? null} fmt={compact} note="every post's reach added up" />
          <Kpi label="Typical post" value={p.typical} prev={prev?.typical ?? null} fmt={compact} note="median reach" />
          <Kpi label="Hit rate" value={p.hitRate * 100} prev={prev ? prev.hitRate * 100 : null} fmt={n => `${Math.round(n)}%`} note={`${p.hits} posts ≥ 2× typical`} points />
          <Kpi label="Shares per 1K" value={p.sharesK ?? 0} prev={p.sharesK === null ? null : prev?.sharesK ?? null} fmt={x => (p.sharesK === null ? '—' : rate(x))} note="median post" />
          <Kpi label="Saves per 1K" value={p.savesK ?? 0} prev={p.savesK === null ? null : prev?.savesK ?? null} fmt={x => (p.savesK === null ? '—' : rate(x))} note="median post" />
          <Kpi label="Reel watch" value={p.watch ?? 0} prev={prev?.watch ?? null} fmt={n => (p.watch === null ? '—' : `${n.toFixed(1)}s`)} note="median, per play" />
        </section>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Reach</h2>
          <p className="v3-chapter-note">How far the slice travelled, and who saw it. Click a bar to zoom the whole page into it.</p>
        </div>
        <Panel
          id="time"
          span={8}
          title="Reach over time"
          note={zoom ? 'One bar per week of the month you picked' : `${today.slice(0, 4)} month by month, for the pattern · ${rangeLabel.toLowerCase()} highlighted`}
          scope={zoom ? 'All filters' : 'Whole year · other filters apply'}
        >
          {/* The one panel where a longer view is the point: a trend needs its year around it. Zoomed
              into a month it shows that month's weeks only. */}
          <TimelineChart
            posts={zoom ? posts : slice(lab.posts, { ...f, range: { from: since, to: today } })}
            range={zoom ? range : { from: since, to: today }}
            focus={zoom ? null : range}
            tips={tips}
            onZoom={(r, label) => setZoom({ range: r, label })}
          />
        </Panel>
        <Panel id="who" span={4} title="Who saw it" note="Unique accounts per 30-day window, from Instagram" scope="Timeline only · account-wide">
          <WhoSaw windows={lab.windows} range={range} tips={tips} />
        </Panel>
        <Panel id="scatter" span={12} title="Every post" note="Each dot is one post, raised by its reach (log scale). Solid dots doubled the typical post. Click a dot to open it." scope="All filters">
          <Scatter posts={posts} range={range} typical={p.typical} hook={hook} tips={tips} />
        </Panel>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">What works</h2>
          <p className="v3-chapter-note">Judged against the typical post in this slice. Click a row or a cell to filter the page by it.</p>
        </div>
        <Panel id="hooks" span={7} title="Which hooks work" note="The caption's first line, grouped by what it promises" scope="Ignores the hook filter">
          <HookBoard posts={slice(lab.posts, f, ['hook'])} chosen={hook} onPick={k => setHook(hook === k ? '' : k)} tips={tips} />
        </Panel>
        <Panel id="grid" span={5} title="Angle × format" note="Typical reach per post · darker travels further" scope="Ignores angle & format">
          <AngleGrid
            posts={slice(lab.posts, f, ['angle', 'format'])}
            chosen={{ angle, format }}
            onPick={(a, fm) => {
              setAngle(angle === a && format === fm ? '' : a)
              setFormat(angle === a && format === fm ? '' : fm)
            }}
            tips={tips}
          />
        </Panel>
        <Panel id="watch" span={7} title="Watch time decides Reel reach" note="Reels grouped by average watch per play" scope="Reels only · ignores format">
          <WatchChart posts={slice(lab.posts, f, ['format'])} tips={tips} />
        </Panel>
        <Panel id="brand" span={5} title="Where the brand goes" note="Brand or partner named in the hook, further down, or not at all" scope="Ignores angle">
          <BrandPlacement posts={slice(lab.posts, f, ['angle'])} tips={tips} />
        </Panel>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Timing</h2>
          <p className="v3-chapter-note">When the slice was posted, and how few posts carried it.</p>
        </div>
        <Panel id="when" span={7} title="When to post" note="Typical reach by weekday and time of day · Malaysia time" scope="All filters">
          <WhenGrid posts={posts} tips={tips} />
        </Panel>
        <Panel id="pareto" span={5} title="How few posts carry the reach" note="Share of combined reach from the top posts" scope="All filters">
          <Pareto posts={posts} tips={tips} />
        </Panel>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">The posts</h2>
          <p className="v3-chapter-note">The hook line is the headline — read them side by side.</p>
        </div>
        <Panel id="list" span={12} title="Ranked" scope="All filters">
          <Ranked posts={posts} typical={p.typical} />
        </Panel>
      </div>
      <TipLayer tip={tips.tip} />
    </div>
  )
}

// ------------------------------------------------------------------ KPI tile

function Kpi({ label, value, prev, fmt = num, note, points }: { label: string; value: number; prev: number | null; fmt?: (n: number) => string; note?: string; points?: boolean }) {
  const d = prev === null || !Number.isFinite(prev) ? null : points ? value - prev : prev ? (value - prev) / prev : null
  return (
    <div className="lab-kpi">
      <div className="lab-kpi-l">{label}</div>
      <div className="lab-kpi-v">
        <Count value={value} format={fmt} />
      </div>
      <div className="lab-kpi-n">
        {d !== null ? (
          <span className="lab-delta" data-dir={d > 0.005 ? 'up' : d < -0.005 ? 'down' : 'flat'}>
            {d > 0 ? '▲' : d < 0 ? '▼' : '•'} {points ? `${Math.abs(Math.round(d))} pts` : `${Math.abs(Math.round(d * 100))}%`}
          </span>
        ) : null}
        {note ? <span>{note}</span> : null}
      </div>
    </div>
  )
}

type Tips = ReturnType<typeof useTip>

// ------------------------------------------------------------------ reach over time

function TimelineChart({ posts, range, focus, tips, onZoom }: { posts: LabPost[]; range: Range; focus: Range | null; tips: Tips; onZoom: (r: Range, label: string) => void }) {
  const [metric, setMetric] = useState<'reach' | 'median' | 'n'>('reach')
  const buckets = timeline(posts, range)
  // The typical line is the highlighted slice's, so it matches the numbers above.
  const typical = median((focus ? posts.filter(p => mytDay(p.at) >= focus.from && mytDay(p.at) <= focus.to) : posts).map(p => p.reach))
  const val = (b: (typeof buckets)[number]) => (metric === 'reach' ? b.reach : metric === 'median' ? b.median : b.n)
  const max = Math.max(1, ...buckets.map(val))
  const W = 720
  const H = 220
  const pad = { l: 44, r: 8, t: 12, b: 26 }
  const bw = r1((W - pad.l - pad.r) / Math.max(1, buckets.length))
  const y = (x: number) => r1(pad.t + (H - pad.t - pad.b) * (1 - x / max))
  const ticks = [0, 0.5, 1].map(k => k * max)
  const weekly = buckets.length > 0 && (Date.parse(buckets[0].to) - Date.parse(buckets[0].from)) / 86_400_000 < 8
  const every = Math.ceil(buckets.length / 12)
  return (
    <>
      <div className="lab-panel-tools">
        <div className="v3-seg" role="group" aria-label="What the bars show">
          {(
            [
              ['reach', 'Combined reach'],
              ['median', 'Typical post'],
              ['n', 'Posts'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <svg className="lab-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Reach per ${weekly ? 'week' : 'month'}`} onPointerLeave={tips.hide}>
        {ticks.map((t, i) => (
          <g key={i} className="lab-grid">
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">
              {metric === 'n' ? Math.round(t) : compact(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const h = H - pad.b - y(val(b))
          const label = weekly ? `Week of ${shortDate(b.key)}` : longDate(b.key).replace(/^1 /, '')
          const body = (
            <div>
              <div className="lab-tip-hook">{label}</div>
              <div className="lab-tip-nums">
                <span>
                  <b>{compact(b.reach)}</b> combined reach
                </span>
                <span>
                  <b>{compact(b.median)}</b> typical
                </span>
                <span>
                  <b>{b.n}</b> posts
                </span>
              </div>
              {b.best ? <div className="lab-tip-meta">Best: {b.best.hook || '(no caption)'} · {compact(b.best.reach)}</div> : null}
              {focus && b.from < focus.from && b.to >= focus.from ? <div className="lab-tip-meta">This bar is the whole {weekly ? 'week' : 'month'}; the highlight starts {shortDate(focus.from)}.</div> : null}
              {b.n ? <div className="lab-tip-cta">Click to zoom in</div> : null}
            </div>
          )
          return (
            <g
              key={b.key}
              className="lab-hit"
              tabIndex={b.n ? 0 : -1}
              role="button"
              aria-label={`${label}: ${num(val(b))}`}
              onPointerMove={e => tips.show(e, body)}
              onFocus={e => tips.focus(e, body)}
              onBlur={tips.hide}
              onClick={() => b.n && onZoom({ from: b.from, to: b.to }, weekly ? `Week of ${shortDate(b.key)}` : label)}
              onKeyDown={e => e.key === 'Enter' && b.n && onZoom({ from: b.from, to: b.to }, label)}
            >
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect
                className="lab-bar"
                x={pad.l + i * bw + Math.min(2, bw * 0.1)}
                y={H - pad.b - Math.max(h, b.n ? 2 : 0)}
                width={Math.max(1, bw - Math.min(4, bw * 0.2))}
                height={Math.max(h, b.n ? 2 : 0)}
                rx={Math.min(4, bw / 4)}
                data-out={(focus && (b.to < focus.from || b.from > focus.to)) || undefined}
                style={{ ['--i' as string]: i }}
              />
              {i % every === 0 ? (
                <text className="lab-axis" x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">
                  {b.label}
                </text>
              ) : null}
            </g>
          )
        })}
        {metric === 'median' && typical ? (
          <g className="lab-ref">
            <line x1={pad.l} x2={W - pad.r} y1={y(typical)} y2={y(typical)} />
            <text x={W - pad.r} y={y(typical) - 5} textAnchor="end">
              slice typical {compact(typical)}
            </text>
          </g>
        ) : null}
      </svg>
    </>
  )
}

// ------------------------------------------------------------------ who saw it (account windows)

function WhoSaw({ windows, range, tips }: { windows: Lab['windows']; range: Range; tips: Tips }) {
  const ws = windows.filter(w => w.until >= range.from && w.since <= range.to && w.reach > 0)
  if (!ws.length) return <p className="v3-empty">Instagram keeps account windows for about two years — none overlap this timeline.</p>
  const max = Math.max(1, ...ws.map(w => w.followers + w.nonFollowers))
  const totalF = ws.reduce((a, w) => a + w.followers, 0)
  const totalN = ws.reduce((a, w) => a + w.nonFollowers, 0)
  const newPct = totalN / Math.max(1, totalF + totalN)
  return (
    <div className="lab-who">
      <div className="lab-who-hero">
        <b className="num">
          <Count value={newPct * 100} format={n => `${Math.round(n)}%`} />
        </b>
        <span>
          of people reached were not followers · average of {ws.length} Instagram window{ws.length === 1 ? '' : 's'}, {shortDate(ws[0].since)} – {shortDate(ws.at(-1)!.until)}
        </span>
      </div>
      <div className="lab-who-bars">
        {ws.map((w, i) => {
          const body = (
            <div>
              <div className="lab-tip-hook">
                {shortDate(w.since)} – {shortDate(w.until)}
              </div>
              <div className="lab-tip-nums">
                <span>
                  <b>{compact(w.reach)}</b> unique reach
                </span>
                <span>
                  <b>{compact(w.nonFollowers)}</b> new people
                </span>
                <span>
                  <b>{compact(w.followers)}</b> followers
                </span>
              </div>
            </div>
          )
          return (
            <div
              key={w.since}
              className="lab-who-bar"
              tabIndex={0}
              aria-label={`${shortDate(w.since)}: ${num(w.reach)} reached`}
              onPointerMove={e => tips.show(e, body)}
              onPointerLeave={tips.hide}
              onFocus={e => tips.focus(e, body)}
              onBlur={tips.hide}
            >
              <i className="lab-who-new" style={{ ['--h' as string]: (w.nonFollowers / max).toFixed(3), ['--i' as string]: i }} />
              <i className="lab-who-fol" style={{ ['--h' as string]: Math.max(0.012, w.followers / max).toFixed(3), ['--i' as string]: i }} />
            </div>
          )
        })}
      </div>
      <div className="v3-legend lab-legend">
        <span>
          <i className="lab-sw new" />
          New people
        </span>
        <span>
          <i className="lab-sw fol" />
          Followers
        </span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ every post

function Scatter({ posts, range, typical, hook, tips }: { posts: LabPost[]; range: Range; typical: number; hook: HookKey | ''; tips: Tips }) {
  const W = 1000
  const H = 300
  const pad = { l: 48, r: 12, t: 12, b: 26 }
  const t0 = Date.parse(range.from + 'T00:00:00+08:00')
  const t1 = Date.parse(range.to + 'T23:59:59+08:00')
  const lo = Math.max(100, Math.min(...posts.map(p => p.reach || 1)))
  const hi = Math.max(lo * 10, ...posts.map(p => p.reach))
  const L0 = Math.log10(lo)
  const L1 = Math.log10(hi)
  const x = (iso: string) => r1(pad.l + ((Date.parse(iso) - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r))
  const y = (r: number) => r1(pad.t + (1 - (Math.log10(Math.max(lo, r)) - L0) / (L1 - L0)) * (H - pad.t - pad.b))
  const pts = posts.map(p => ({ p, x: x(p.at), y: y(p.reach) }))
  const [hot, setHot] = useState<string | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const ticks: number[] = []
  for (let e = Math.ceil(L0); e <= Math.floor(L1); e++) ticks.push(10 ** e)
  const months = useMemo(() => {
    const out: { x: number; label: string }[] = []
    const span = (t1 - t0) / 86_400_000
    const step = span > 900 ? 12 : span > 400 ? 3 : 1
    const d = new Date(range.from + 'T00:00:00Z')
    d.setUTCDate(1)
    for (; d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + step)) {
      const iso = d.toISOString()
      if (Date.parse(iso) >= t0) out.push({ x: x(iso), label: step === 12 ? String(d.getUTCFullYear()) : longDate(iso).replace(/^1 /, '').replace(/ 20(\d\d)$/, " '$1") })
    }
    return out
  }, [range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nearest post to the pointer — a 6px dot is too small to aim at.
  const near = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const py = ((e.clientY - r.top) / r.height) * H
    let best: (typeof pts)[number] | null = null
    let bd = 900 // within 30 viewBox units
    for (const q of pts) {
      const d = (q.x - px) ** 2 + (q.y - py) ** 2
      if (d < bd) {
        bd = d
        best = q
      }
    }
    return best
  }
  if (!posts.length) return <p className="v3-empty">No posts in this slice.</p>
  const hotPt = pts.find(q => q.p.id === hot)
  return (
    <svg
      ref={svg}
      className="lab-svg lab-scatter"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${posts.length} posts by reach over time`}
      onPointerMove={e => {
        const q = near(e)
        setHot(q?.p.id ?? null)
        if (q) tips.show(e, <PostTip p={q.p} typical={typical} />)
        else tips.hide()
      }}
      onPointerLeave={() => {
        setHot(null)
        tips.hide()
      }}
      onClick={e => {
        const q = near(e as unknown as React.PointerEvent<SVGSVGElement>)
        if (q?.p.link) window.open(q.p.link, '_blank', 'noopener')
      }}
    >
      {ticks.map(t => (
        <g key={t} className="lab-grid">
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">
            {compact(t)}
          </text>
        </g>
      ))}
      {months.map(m => (
        <text key={m.x} className="lab-axis" x={m.x} y={H - 8} textAnchor="middle">
          {m.label}
        </text>
      ))}
      {typical ? (
        <g className="lab-ref">
          <line x1={pad.l} x2={W - pad.r} y1={y(typical)} y2={y(typical)} />
          <line className="hit" x1={pad.l} x2={W - pad.r} y1={y(2 * typical)} y2={y(2 * typical)} />
          <text x={W - pad.r} y={y(typical) + 14} textAnchor="end">
            typical {compact(typical)}
          </text>
          <text x={W - pad.r} y={y(2 * typical) - 5} textAnchor="end">
            2× = hit
          </text>
        </g>
      ) : null}
      <g>
        {pts.map((q, i) => (
          <circle
            key={q.p.id}
            className="lab-dot"
            data-hit={q.p.reach >= 2 * typical || undefined}
            data-dim={(hook && q.p.hookType !== hook) || undefined}
            cx={q.x}
            cy={q.y}
            r={q.p.reach >= 2 * typical ? 4.5 : 3.5}
            style={{ ['--i' as string]: Math.min(i, 400) }}
          />
        ))}
      </g>
      {hotPt ? <circle className="lab-dot-ring" cx={hotPt.x} cy={hotPt.y} r={9} /> : null}
    </svg>
  )
}

// ------------------------------------------------------------------ hook board

function HookBoard({ posts, chosen, onPick, tips }: { posts: LabPost[]; chosen: HookKey | ''; onPick: (k: HookKey) => void; tips: Tips }) {
  const typical = median(posts.map(p => p.reach))
  const rows = HOOKS.map(h => ({ h, g: group(posts.filter(p => p.hookType === h.key), typical) }))
    .filter(r => r.g.n > 0)
    .sort((a, b) => Number(a.g.thin) - Number(b.g.thin) || b.g.median - a.g.median)
  const max = Math.max(1, ...rows.map(r => r.g.median))
  const plain = rows.find(r => r.h.key === 'plain')?.g.median ?? 0
  if (!rows.length) return <p className="v3-empty">No posts in this slice.</p>
  return (
    <div className="lab-board" role="list">
      <div className="lab-board-head" aria-hidden="true">
        <span>Hook</span>
        <span>Typical reach</span>
        <span>Hit rate</span>
        <span>Shares/1K</span>
        <span>Saves/1K</span>
      </div>
      {rows.map(({ h, g }, i) => {
        const body = (
          <div>
            <div className="lab-tip-hook">{h.label}</div>
            <div className="lab-tip-meta">e.g. “{g.best?.hook || h.example}”</div>
            <div className="lab-tip-nums">
              <span>
                <b>{g.n}</b> posts
              </span>
              <span>
                <b>{compact(g.median)}</b> typical
              </span>
              {plain && h.key !== 'plain' ? (
                <span>
                  <b>{times(g.median / plain)}</b> plain captions
                </span>
              ) : null}
              <span>
                <b>{compact(g.reach)}</b> combined
              </span>
            </div>
            <div className="lab-tip-cta">{chosen === h.key ? 'Click to clear' : 'Click to filter the page'}</div>
          </div>
        )
        return (
          <button
            key={h.key}
            type="button"
            role="listitem"
            className="lab-board-row"
            aria-pressed={chosen === h.key}
            data-thin={g.thin || undefined}
            data-dim={(chosen && chosen !== h.key) || undefined}
            onClick={() => onPick(h.key)}
            onPointerMove={e => tips.show(e, body)}
            onPointerLeave={tips.hide}
            onFocus={e => tips.focus(e, body)}
            onBlur={tips.hide}
            style={{ ['--i' as string]: i }}
          >
            <span className="lab-board-name">
              <i className="lab-key" data-hook={h.key} />
              {h.short}
              <small>{g.n} posts{g.thin ? ' · thin' : ''}</small>
            </span>
            <span className="lab-board-bar">
              <i data-hook={h.key} style={{ ['--w' as string]: (g.median / max).toFixed(3) }} />
              <b className="num">{compact(g.median)}</b>
            </span>
            <span className="num">{pc(g.hitRate)}</span>
            <span className="num">{rate(g.sharesK)}</span>
            <span className="num">{rate(g.savesK)}</span>
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ angle × format

function AngleGrid({ posts, chosen, onPick, tips }: { posts: LabPost[]; chosen: { angle: AngleKey | ''; format: Format | '' }; onPick: (a: AngleKey, f: Format) => void; tips: Tips }) {
  const typical = median(posts.map(p => p.reach))
  const cells = ANGLES.map(a => ({ a, row: FORMATS.map(fm => ({ fm, g: group(posts.filter(p => p.angle === a.key && p.format === fm.key), typical) })) })).filter(r =>
    r.row.some(c => c.g.n),
  )
  const max = Math.max(1, ...cells.flatMap(r => r.row.filter(c => !c.g.thin).map(c => c.g.median)))
  if (!cells.length) return <p className="v3-empty">No posts in this slice.</p>
  return (
    <div className="lab-heat" style={{ ['--cols' as string]: FORMATS.length }}>
      <span />
      {FORMATS.map(fm => (
        <span key={fm.key} className="lab-heat-col">
          {fm.label}
        </span>
      ))}
      {cells.map(({ a, row }, ri) => (
        <div key={a.key} className="lab-heat-row">
          <span className="lab-heat-lab">{a.label}</span>
          {row.map(({ fm, g }, ci) => {
            const on = chosen.angle === a.key && chosen.format === fm.key
            const body = (
              <div>
                <div className="lab-tip-hook">
                  {a.label} · {fm.label}
                </div>
                <div className="lab-tip-nums">
                  <span>
                    <b>{g.n}</b> posts
                  </span>
                  <span>
                    <b>{compact(g.median)}</b> typical
                  </span>
                  <span>
                    <b>{times(g.lift)}</b> slice typical
                  </span>
                  <span>
                    <b>{pc(g.hitRate)}</b> hits
                  </span>
                </div>
                {g.best ? <div className="lab-tip-meta">Best: {g.best.hook || '(no caption)'}</div> : null}
                {g.thin && g.n ? <div className="lab-tip-cta">Fewer than 3 posts — not a finding yet</div> : null}
              </div>
            )
            return (
              <button
                key={fm.key}
                type="button"
                className="lab-heat-cell"
                disabled={!g.n}
                aria-pressed={on}
                aria-label={`${a.label}, ${fm.label}: ${g.n} posts, typical ${num(g.median)}`}
                data-thin={g.thin || undefined}
                style={{ ['--a' as string]: g.n && !g.thin ? (0.08 + 0.92 * Math.sqrt(g.median / max)).toFixed(3) : 0, ['--i' as string]: ri * 3 + ci }}
                onClick={() => onPick(a.key, fm.key)}
                onPointerMove={e => tips.show(e, body)}
                onPointerLeave={tips.hide}
                onFocus={e => tips.focus(e, body)}
                onBlur={tips.hide}
              >
                {g.n ? (
                  <span className="lab-pill">
                    <b className="num">{compact(g.median)}</b>
                    <small>{g.n}</small>
                  </span>
                ) : (
                  '—'
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ watch time

function WatchChart({ posts, tips }: { posts: LabPost[]; tips: Tips }) {
  const reels = posts.filter(p => p.format === 'reel' && p.watchSec !== null)
  const typical = median(reels.map(p => p.reach))
  const bands = watchBands(reels, typical)
  const max = Math.max(1, ...bands.filter(b => !b.thin).map(b => b.median))
  if (reels.length < 5) return <p className="v3-empty">Too few Reels with watch time in this slice.</p>
  const tenAt = bands.findIndex(b => b.from === 10)
  return (
    <div className="lab-cols" style={{ ['--n' as string]: bands.length }}>
      {bands.map((b, i) => {
        const body = (
          <div>
            <div className="lab-tip-hook">Watched {b.label} per play</div>
            <div className="lab-tip-nums">
              <span>
                <b>{b.n}</b> Reels
              </span>
              <span>
                <b>{compact(b.median)}</b> typical reach
              </span>
              <span>
                <b>{times(b.lift)}</b> Reel typical
              </span>
              <span>
                <b>{pc(b.hitRate)}</b> hits
              </span>
            </div>
            {b.best ? <div className="lab-tip-meta">Best: {b.best.hook}</div> : null}
          </div>
        )
        return (
          <div
            key={b.label}
            className="lab-col"
            data-thin={b.thin || undefined}
            data-after={i >= tenAt || undefined}
            tabIndex={0}
            onPointerMove={e => tips.show(e, body)}
            onPointerLeave={tips.hide}
            onFocus={e => tips.focus(e, body)}
            onBlur={tips.hide}
          >
            <b className="num">{b.n ? compact(b.median) : '—'}</b>
            <div className="lab-col-track">
              <i style={{ ['--h' as string]: b.thin ? 0.02 : (b.median / max).toFixed(3), ['--i' as string]: i }} />
            </div>
            <span>{b.label}</span>
            <small>{b.n} Reels</small>
          </div>
        )
      })}
      {tenAt > 0 ? (
        <div className="lab-col-mark" style={{ ['--at' as string]: tenAt }}>
          <span>10s line</span>
        </div>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ brand placement

function BrandPlacement({ posts, tips }: { posts: LabPost[]; tips: Tips }) {
  const typical = median(posts.map(p => p.reach))
  const rows = (
    [
      ['hook', 'Brand in the hook', 'The first line names the brand or the partnership'],
      ['body', 'Brand further down', 'Hook leads with the place or the news; brand on a later line'],
      ['none', 'No brand', 'Your own posts'],
    ] as const
  ).map(([k, l, d]) => ({ k, l, d, g: group(posts.filter(p => p.brand === k), typical) }))
  const max = Math.max(1, ...rows.map(r => r.g.median))
  const [hk, bd] = [rows[0].g, rows[1].g]
  return (
    <div className="lab-brand">
      {hk.n >= 3 && bd.n >= 3 && hk.median ? (
        <p className="lab-callout">
          Moving the brand below the hook: <b className="num">{times(bd.median / hk.median)}</b> the typical reach.
        </p>
      ) : null}
      {rows.map((r, i) => {
        const body = (
          <div>
            <div className="lab-tip-hook">{r.l}</div>
            <div className="lab-tip-meta">{r.d}</div>
            <div className="lab-tip-nums">
              <span>
                <b>{r.g.n}</b> posts
              </span>
              <span>
                <b>{compact(r.g.median)}</b> typical
              </span>
              <span>
                <b>{rate(r.g.sharesK)}</b> shares/1K
              </span>
            </div>
            {r.g.best ? <div className="lab-tip-meta">Best: {r.g.best.hook}</div> : null}
          </div>
        )
        return (
          <div
            key={r.k}
            className="lab-hbar"
            data-thin={r.g.thin || undefined}
            tabIndex={0}
            onPointerMove={e => tips.show(e, body)}
            onPointerLeave={tips.hide}
            onFocus={e => tips.focus(e, body)}
            onBlur={tips.hide}
          >
            <span className="lab-hbar-l">
              {r.l}
              <small>{r.g.n} posts</small>
            </span>
            <span className="lab-hbar-t">
              <i data-kind={r.k} style={{ ['--w' as string]: (r.g.median / max).toFixed(3), ['--i' as string]: i }} />
            </span>
            <b className="num">{r.g.n ? compact(r.g.median) : '—'}</b>
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ when to post

function WhenGrid({ posts, tips }: { posts: LabPost[]; tips: Tips }) {
  const [skipMoments, setSkip] = useState(true)
  const ps = skipMoments ? posts.filter(p => p.angle !== 'moment') : posts
  const w = when(ps)
  const best = w.grid.flatMap((r, d) => r.map((c, t) => ({ c, d, t }))).filter(x => x.c.n >= 2).sort((a, b) => b.c.median - a.c.median)[0]
  return (
    <>
      <div className="lab-panel-tools">
        <label className="lab-check">
          <input type="checkbox" checked={skipMoments} onChange={e => setSkip(e.target.checked)} /> Leave out festive spikes
        </label>
        {best ? (
          <span className="v3-panel-note">
            Best slot: <b>{WEEKDAYS[best.d]} {DAYPARTS[best.t].label.toLowerCase()}</b> · {compact(best.c.median)} typical over {best.c.n} posts
          </span>
        ) : null}
      </div>
      <div className="lab-when">
        <span />
        {DAYPARTS.map(d => (
          <span key={d.label} className="lab-heat-col">
            <span className="lab-full">{d.label}</span>
            <span className="lab-abbr" aria-hidden="true">
              {d.label.slice(0, 3)}
            </span>
            <small>{d.hours}</small>
          </span>
        ))}
        {WEEKDAYS.map((day, di) => (
          <div key={day} className="lab-heat-row">
            <span className="lab-heat-lab">{day}</span>
            {w.grid[di].map((c, ti) => {
              const body = (
                <div>
                  <div className="lab-tip-hook">
                    {day} · {DAYPARTS[ti].label} ({DAYPARTS[ti].hours})
                  </div>
                  <div className="lab-tip-nums">
                    <span>
                      <b>{c.n}</b> posts
                    </span>
                    <span>
                      <b>{compact(c.median)}</b> typical
                    </span>
                  </div>
                  {c.best ? <div className="lab-tip-meta">Best: {c.best.hook}</div> : null}
                  {c.n === 1 ? <div className="lab-tip-cta">One post — not a pattern</div> : null}
                </div>
              )
              return (
                <span
                  key={ti}
                  className="lab-heat-cell"
                  tabIndex={0}
                  data-thin={c.n < 2 || undefined}
                  data-best={(best && best.d === di && best.t === ti) || undefined}
                  style={{ ['--a' as string]: c.n >= 2 ? (0.08 + 0.92 * Math.sqrt(c.median / w.max)).toFixed(3) : 0, ['--i' as string]: di * 4 + ti }}
                  onPointerMove={e => tips.show(e, body)}
                  onPointerLeave={tips.hide}
                  onFocus={e => tips.focus(e, body)}
                  onBlur={tips.hide}
                >
                  {c.n ? (
                    <span className="lab-pill">
                      <b className="num">{compact(c.median)}</b>
                    </span>
                  ) : (
                    '·'
                  )}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

// ------------------------------------------------------------------ concentration

function Pareto({ posts, tips }: { posts: LabPost[]; tips: Tips }) {
  const c = concentration(posts)
  const [at, setAt] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  if (c.length < 5) return <p className="v3-empty">Too few posts in this slice.</p>
  const W = 400
  const H = 200
  const pad = { l: 34, r: 10, t: 10, b: 24 }
  const x = (n: number) => r1(pad.l + ((n - 1) / Math.max(1, c.length - 1)) * (W - pad.l - pad.r))
  const y = (s: number) => r1(pad.t + (1 - s) * (H - pad.t - pad.b))
  const d = c.map((q, i) => `${i ? 'L' : 'M'}${x(q.n).toFixed(1)},${y(q.share).toFixed(1)}`).join('')
  const pick = (n: number) => c[Math.min(c.length, Math.max(1, n)) - 1]
  const marks = [5, 10, Math.ceil(c.length * 0.1)].filter((n, i, a) => n <= c.length && a.indexOf(n) === i).map(pick)
  const half = c.find(q => q.share >= 0.5)!
  const hot = at ? pick(at) : null
  return (
    <>
      <p className="lab-callout">
        Half of all reach came from <b className="num">{half.n}</b> of {c.length} posts ({pc(half.n / c.length)}).
      </p>
      <svg
        ref={svg}
        className="lab-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Share of reach by top posts"
        onPointerMove={e => {
          const r = svg.current!.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const n = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (c.length - 1)) + 1
          const q = pick(n)
          setAt(q.n)
          tips.show(
            e,
            <div>
              <div className="lab-tip-hook">Top {q.n} posts</div>
              <div className="lab-tip-nums">
                <span>
                  <b>{pc(q.share)}</b> of combined reach
                </span>
                <span>
                  <b>{pc(q.n / c.length)}</b> of posts
                </span>
              </div>
            </div>,
          )
        }}
        onPointerLeave={() => {
          setAt(null)
          tips.hide()
        }}
      >
        {[0, 0.5, 1].map(s => (
          <g key={s} className="lab-grid">
            <line x1={pad.l} x2={W - pad.r} y1={y(s)} y2={y(s)} />
            <text x={pad.l - 5} y={y(s) + 4} textAnchor="end">
              {s * 100}%
            </text>
          </g>
        ))}
        <path className="lab-line lab-draw" d={d} pathLength={1} />
        {marks.map(q => (
          <g key={q.n} className="lab-mark">
            <circle cx={x(q.n)} cy={y(q.share)} r={4} />
            <text x={x(q.n) + 6} y={y(q.share) + 14}>
              top {q.n}: {pc(q.share)}
            </text>
          </g>
        ))}
        {hot ? (
          <g className="lab-cross">
            <line x1={x(hot.n)} x2={x(hot.n)} y1={pad.t} y2={H - pad.b} />
            <circle cx={x(hot.n)} cy={y(hot.share)} r={5} />
          </g>
        ) : null}
        <text className="lab-axis" x={pad.l} y={H - 6}>
          #1
        </text>
        <text className="lab-axis" x={W - pad.r} y={H - 6} textAnchor="end">
          #{c.length}
        </text>
      </svg>
    </>
  )
}

// ------------------------------------------------------------------ ranked posts

const SORTS = [
  { key: 'reach', label: 'Furthest reach', by: (p: LabPost) => p.reach },
  { key: 'shares', label: 'Most shared', by: (p: LabPost) => p.shares ?? -1 },
  { key: 'saves', label: 'Most saved', by: (p: LabPost) => p.saves ?? -1 },
  { key: 'rate', label: 'Best share rate', by: (p: LabPost) => (p.reach >= 3000 && p.shares !== null ? p.shares / p.reach : -1) },
  { key: 'quiet', label: 'Quietest', by: (p: LabPost) => -p.reach },
] as const

function Ranked({ posts, typical }: { posts: LabPost[]; typical: number }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('reach')
  const [more, setMore] = useState(false)
  const by = SORTS.find(s => s.key === sort)!.by
  const list = [...posts].sort((a, b) => by(b) - by(a)).slice(0, more ? 30 : 9)
  return (
    <>
      <div className="lab-panel-tools">
        <div className="v3-seg" role="group" aria-label="Rank by">
          {SORTS.map(s => (
            <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ol className="lab-posts" key={sort}>
        {list.map((p, i) => {
          const lift = typical ? p.reach / typical : 0
          const h = hookMeta(p.hookType)
          return (
            <li key={p.id} style={{ ['--i' as string]: i }}>
              <a className="lab-post" href={p.link ?? undefined} target="_blank" rel="noreferrer">
                <span className="lab-post-rank num">{String(i + 1).padStart(2, '0')}</span>
                <span className="lab-post-hook">{p.hook || '(no caption)'}</span>
                <span className="lab-post-tags">
                  <span className="lab-tag">
                    <i className="lab-key" data-hook={h.key} />
                    {h.short}
                  </span>
                  <span className="lab-tag">{fmtLabel(p.format)}</span>
                  <span className="lab-tag">{angleLabel(p.angle)}</span>
                  <span className="lab-tag" data-verdict={lift >= 2 ? 'hit' : lift < 0.5 ? 'low' : undefined}>
                    {lift >= 2 ? `Hit · ${times(lift)}` : lift < 0.5 ? `Quiet · ${times(lift)}` : `${times(lift)} typical`}
                  </span>
                </span>
                <span className="lab-post-nums">
                  <span>
                    <b className="num">{compact(p.reach)}</b> reach
                  </span>
                  <span>
                    <b className="num">{c0(p.shares)}</b> shares
                  </span>
                  <span>
                    <b className="num">{c0(p.saves)}</b> saves
                  </span>
                  {p.watchSec !== null ? (
                    <span>
                      <b className="num">{p.watchSec.toFixed(1)}s</b> watch
                    </span>
                  ) : null}
                  <span className="lab-post-date">{longDate(mytDay(p.at))}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ol>
      {posts.length > 9 ? (
        <button type="button" className="v3-btn lab-more" onClick={() => setMore(!more)}>
          {more ? 'Show fewer' : `Show ${Math.min(30, posts.length)}`}
        </button>
      ) : null}
    </>
  )
}
