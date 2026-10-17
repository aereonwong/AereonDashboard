'use client'

import { useEffect } from 'react'

// One hover readout for every chart that is drawn on the server. A mark only has to
// carry data-tip="Heading\nline\nline" — no client component, no state — and this
// shows it beside the pointer the moment the mouse is over it (a finger tap shows it
// too, a tap elsewhere hides it; keyboard focus on a focusable mark works the same).
// Client charts with their own .v3-tip (TrendBars, SeriesChart, PaceChart…) keep it;
// this is the same card for everything else. Rule: docs/CHARTS.md.
//
// First line = muted heading, the rest = the figures. MoneyMask masks data-tip like
// title, so hidden amounts stay "RM *****" here as well.

export default function ChartTips() {
  useEffect(() => {
    let tip: HTMLDivElement | null = null
    let on: Element | null = null

    const place = (x: number, y: number) => {
      if (!tip) return
      const r = tip.getBoundingClientRect()
      const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))
      const above = y - r.height - 14
      tip.style.left = `${left}px`
      tip.style.top = `${above < 8 ? y + 20 : above}px`
    }

    const show = (el: Element, x: number, y: number) => {
      const text = el.getAttribute('data-tip')
      if (!text) return hide()
      if (on !== el) {
        on?.removeAttribute('data-tip-on')
        on = el
        el.setAttribute('data-tip-on', '')
        // Inside the v3 frame so it picks up that palette's tokens.
        const host = el.closest('.v3') ?? document.body
        if (!tip || tip.parentElement !== host) {
          tip?.remove()
          tip = document.createElement('div')
          tip.className = 'chart-tip'
          tip.setAttribute('role', 'tooltip')
          host.appendChild(tip)
        }
        // "Label: figure" on one line reads as heading + figure too.
        const colon = text.includes('\n') ? -1 : text.indexOf(': ')
        const [head, ...rest] = colon > 0 ? [text.slice(0, colon), text.slice(colon + 2)] : text.split('\n')
        tip.replaceChildren()
        const h = document.createElement('div')
        h.className = rest.length ? 'chart-tip-head' : 'chart-tip-solo'
        h.textContent = head
        tip.appendChild(h)
        for (const line of rest) {
          const d = document.createElement('div')
          d.textContent = line
          tip.appendChild(d)
        }
        tip.hidden = false
      }
      place(x, y)
    }

    const hide = () => {
      on?.removeAttribute('data-tip-on')
      on = null
      if (tip) tip.hidden = true
    }

    const mark = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-tip]') : null)

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const el = mark(e.target)
      if (el) show(el, e.clientX, e.clientY)
      else if (on) hide()
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      const el = mark(e.target)
      if (el) show(el, e.clientX, e.clientY)
      else hide()
    }
    const focus = (e: FocusEvent) => {
      const el = mark(e.target)
      if (!el) return
      const r = el.getBoundingClientRect()
      show(el, r.left + r.width / 2, r.top)
    }
    const leaveDoc = (e: PointerEvent) => {
      if (!e.relatedTarget) hide()
    }

    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerdown', down, { passive: true })
    document.addEventListener('pointerout', leaveDoc, { passive: true })
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    window.addEventListener('scroll', hide, { passive: true, capture: true })
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerout', leaveDoc)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      window.removeEventListener('scroll', hide, { capture: true })
      on?.removeAttribute('data-tip-on')
      tip?.remove()
    }
  }, [])
  return null
}
