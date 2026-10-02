'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// 👉 The media kit's two motion helpers. Both render the FINAL state on the
// server, so the page is complete with JavaScript off, for crawlers, and under
// reduced motion. Only when motion is allowed do they arm, hide, and play once
// as the section scrolls into view.

const reduced = () =>
  typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A section that plays its CSS entrance once, when it is first seen. */
export function Reveal({ as: Tag = 'section', className, children, ...rest }: {
  as?: 'section' | 'div' | 'header' | 'footer'
  className?: string
  children: ReactNode
  'aria-labelledby'?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduced() || !('IntersectionObserver' in window)) return
    // Already on screen at load: play straight away without hiding first.
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
      el.dataset.armed = 'true'
      requestAnimationFrame(() => (el.dataset.in = 'true'))
      return
    }
    el.dataset.armed = 'true'
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        el.dataset.in = 'true'
        io.disconnect()
      },
      { threshold: 0.18 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const Any = Tag as 'section'
  return (
    <Any ref={ref as React.Ref<HTMLElement>} className={className} {...rest}>
      {children}
    </Any>
  )
}

type Format = 'num' | 'compact' | 'pct' | 'sec' | 'hours'

const fmt = (n: number, f: Format) => {
  switch (f) {
    case 'num':
      return Math.round(n).toLocaleString('en-MY')
    case 'compact': {
      const a = Math.abs(n)
      if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
      if (a >= 1_000) return (n / 1_000).toFixed(a >= 100_000 ? 0 : 1).replace(/\.0$/, '') + 'K'
      return String(Math.round(n))
    }
    case 'pct':
      return `${Math.round(n)}%`
    case 'sec':
      return `${n.toFixed(1)}s`
    case 'hours':
      return Math.round(n).toLocaleString('en-MY')
  }
}

/** A figure that counts up from zero the first time it is seen. */
export function CountUp({ value, format = 'num', ms = 1400 }: { value: number; format?: Format; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const el = ref.current
    if (!el || reduced() || !('IntersectionObserver' in window) || !value) return
    let raf = 0
    const play = () => {
      const t0 = performance.now()
      const tick = (t: number) => {
        const p = Math.min((t - t0) / ms, 1)
        setShown(value * (1 - Math.pow(2, -10 * p))) // expo-out, the system's one curve
        if (p < 1) raf = requestAnimationFrame(tick)
        else setShown(value)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        play()
      },
      { threshold: 0.6 },
    )
    setShown(0)
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, ms])
  return (
    <span ref={ref} className="v3-k2-count">
      {/* Screen readers hear the final figure once, never the ticking. */}
      <span className="v3-visually-hidden">{fmt(value, format)}</span>
      <span aria-hidden="true">{fmt(shown, format)}</span>
    </span>
  )
}
