'use client'

import { useEffect, useRef, useState } from 'react'

// Every money figure behind the sign-in starts hidden as "RM *****" — for every
// role, owner included — and shows only when clicked (or with "Show amounts").
// It works on the rendered page rather than on each formatter, so v1, v2, v3,
// charts, tooltips and any page added later are covered without opting in.
//
// How: after hydration it walks the page and rewrites the digits of anything
// that looks like money ("RM 1,234", "USD 2.5K", "RM " + a number in the next
// text node, and any number inside an element marked data-money — chart axes
// that only say "40K"). The original text is kept in memory; React keeps
// owning the same text nodes, so when it writes a new value the observer
// simply masks that again.
//
// This is a screen guard (shoulder-surfing, screen-shares, screenshots), not
// access control: the server still sends the figures to anyone signed in, so a
// viewer can read them through view-source or DevTools. Amounts typed into or
// prefilled in form fields also stay visible, so they can be edited.

const CUR = '(?:RM|MYR|USD|SGD|EUR|RMB|CNY|GBP|AUD|JPY|US\\$|S\\$)'
const AMT = '[-−]?\\d[\\d,]*(?:\\.\\d+)?[KkMm]?'
const MONEY = new RegExp(`\\b(${CUR})(\\s?)${AMT}`, 'g')
const TAIL = new RegExp(`\\b${CUR}\\s?$`) // "… RM " ending one text node
const LEAD = new RegExp(`^${AMT}`) //          "1,234" starting the next
const BARE = /\d[\d,]*(?:\.\d+)?[KkMm]?/g
const STARS = '*****'
const ATTRS = ['title', 'aria-label', 'placeholder'] as const
const SKIP = 'script,style,noscript,textarea,input,select,[data-money-off]'
const SKIP_ATTRS = 'script,style,noscript,[data-money-off]' // an input's placeholder can hold money

type Slot = { raw: string; shown: string; open: boolean }

export default function MoneyMask() {
  const [all, setAll] = useState(false)
  // Originals outlive the toggle, so "Show amounts" can put them back.
  const store = useRef({ texts: new WeakMap<Text, Slot>(), attrs: new WeakMap<Element, Map<string, Slot>>() })

  useEffect(() => {
    const { texts, attrs } = store.current
    let force = !all // first pass after "Hide amounts" re-masks single reveals too

    const maskText = (raw: string, node: Text) => {
      const el = node.parentElement
      if (el?.closest('[data-money]')) return raw.replace(BARE, STARS)
      let out = raw.replace(MONEY, `$1\u00a0${STARS}`)
      const prev = sibling(node, 'previousSibling')
      if (prev instanceof Text && TAIL.test(texts.get(prev)?.raw ?? prev.nodeValue ?? '')) out = out.replace(LEAD, STARS)
      return out
    }

    const doText = (t: Text) => {
      const el = t.parentElement
      if (!el || el.closest(SKIP) || el.isContentEditable) return
      const v = t.nodeValue ?? ''
      const s = texts.get(t)
      if (s && v === s.shown) return // ours, unchanged
      if (s?.open && v === s.raw && !force) return // revealed, unchanged
      if (!/\d/.test(v)) return texts.delete(t) as unknown as void
      const shown = all ? v : maskText(v, t)
      if (shown === v) return texts.delete(t) as unknown as void
      texts.set(t, { raw: v, shown, open: false })
      t.nodeValue = shown
      el.setAttribute('data-mask-hit', '')
    }

    const doAttrs = (el: Element) => {
      if (el.closest(SKIP_ATTRS)) return
      const bare = !!el.closest('[data-money]')
      let m = attrs.get(el)
      for (const a of ATTRS) {
        const v = el.getAttribute(a)
        if (v === null) continue
        const s = m?.get(a)
        if (s && (v === s.shown || (s.open && v === s.raw && !force))) continue
        const shown = all ? v : bare ? v.replace(BARE, STARS) : v.replace(MONEY, `$1\u00a0${STARS}`)
        if (shown === v) {
          m?.delete(a)
          continue
        }
        if (!m) attrs.set(el, (m = new Map()))
        m.set(a, { raw: v, shown, open: false })
        el.setAttribute(a, shown)
      }
    }

    const walk = (root: Node) => {
      if (root instanceof Text) {
        doText(root)
        const next = sibling(root, 'nextSibling')
        if (next instanceof Text) doText(next)
        return
      }
      if (!(root instanceof Element)) return
      doAttrs(root)
      for (const el of root.querySelectorAll('[title],[aria-label],[placeholder]')) doAttrs(el)
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = tw.nextNode(); n; n = tw.nextNode()) doText(n as Text)
    }

    const obs = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') walk(r.target)
        else if (r.type === 'attributes') doAttrs(r.target as Element)
        else r.addedNodes.forEach(walk)
      }
    })

    // "Show amounts" puts every original back before the pass below forgets it.
    if (all) {
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const s = texts.get(n as Text)
        if (s && n.nodeValue === s.shown) n.nodeValue = s.raw
      }
      for (const el of document.body.querySelectorAll('[title],[aria-label],[placeholder]')) {
        for (const [a, s] of attrs.get(el) ?? []) if (el.getAttribute(a) === s.shown) el.setAttribute(a, s.raw)
      }
    }
    walk(document.body)
    force = false
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
    document.documentElement.setAttribute('data-mask-ready', '')

    const reveal = (t: Text) => {
      const s = texts.get(t)
      if (!s || s.open) return false
      s.open = true
      t.nodeValue = s.raw
      return true
    }

    // One click shows the figure under the pointer (and its tooltip); a link
    // or row it sits in only follows on the next click.
    const onClick = (e: MouseEvent) => {
      if (all) return
      const target = e.target instanceof Element ? e.target : null
      if (!target || target.closest('.money-toggle')) return
      let hit = false
      const at = caretNode(e.clientX, e.clientY)
      if (at instanceof Text && target.contains(at)) hit = reveal(at)
      if (!hit) for (const n of target.childNodes) if (n instanceof Text) hit = reveal(n) || hit
      for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
        const m = attrs.get(el)
        if (!m) continue
        for (const [a, s] of m) {
          if (s.open) continue
          s.open = true
          el.setAttribute(a, s.raw)
          hit = true
        }
        break // only the nearest tooltip, not every wrapper's summary label
      }
      if (hit) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClick, true)

    return () => {
      obs.disconnect()
      document.removeEventListener('click', onClick, true)
    }
  }, [all])

  useEffect(() => () => document.documentElement.removeAttribute('data-mask-ready'), [])

  return (
    <>
      <span data-money-guard hidden />
      <button
        type="button"
        className="money-toggle"
        aria-pressed={all}
        onClick={() => setAll(v => !v)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          {all ? <path d="M3 3l18 18" /> : <circle cx="12" cy="12" r="3" />}
        </svg>
        {all ? 'Hide amounts' : 'Show amounts'}
      </button>
    </>
  )
}

// The neighbouring node, stepping over the empty <!-- --> markers React's
// server render puts between adjacent text ("RM <!-- -->0.50").
function sibling(n: Node, dir: 'previousSibling' | 'nextSibling'): Node | null {
  let s = n[dir]
  while (s instanceof Comment) s = s[dir]
  return s
}

function caretNode(x: number, y: number): Node | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  return d.caretPositionFromPoint?.(x, y)?.offsetNode ?? d.caretRangeFromPoint?.(x, y)?.startContainer ?? null
}
