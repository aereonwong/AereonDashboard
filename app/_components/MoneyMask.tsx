'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { IDLE_MS, hideIfExpired, isShown, serverShown, setShown, subscribe, touch } from './money-privacy'

// Privacy mode: every money figure behind the sign-in starts hidden as
// "RM *****" — for every role, owner included. One switch shows them all:
// MoneyToggle in the rail / sidebar / phone bar, or a click on any masked
// figure. Like a banking session it lasts for this browser tab and hides again
// after 5 minutes idle. It works on the rendered page rather than on each formatter, so
// v1, v2, v3, charts, tooltips and any page added later are covered.
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
const ATTR_SEL = '[title],[aria-label],[placeholder]'
const SKIP = 'script,style,noscript,textarea,input,select,[data-money-off]'
const SKIP_ATTRS = 'script,style,noscript,[data-money-off]' // an input's placeholder can hold money

type Slot = { raw: string; shown: string }

export default function MoneyMask() {
  const all = useSyncExternalStore(subscribe, isShown, serverShown)
  // Originals outlive each switch, so showing can put them back.
  const store = useRef({ texts: new WeakMap<Text, Slot>(), attrs: new WeakMap<Element, Map<string, Slot>>() })

  useEffect(() => {
    const { texts, attrs } = store.current

    const maskText = (raw: string, node: Text) => {
      if (node.parentElement?.closest('[data-money]')) return raw.replace(BARE, STARS)
      let out = raw.replace(MONEY, `$1 ${STARS}`)
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
      if (all || !/\d/.test(v)) return void texts.delete(t)
      const shown = maskText(v, t)
      if (shown === v) return void texts.delete(t)
      texts.set(t, { raw: v, shown })
      t.nodeValue = shown
      el.setAttribute('data-mask-hit', '')
    }

    const doAttrs = (el: Element) => {
      if (el.closest(SKIP_ATTRS)) return
      const bare = !!el.closest('[data-money]')
      let m = attrs.get(el)
      for (const a of ATTRS) {
        const v = el.getAttribute(a)
        if (v === null || (m?.get(a)?.shown === v)) continue
        const shown = all ? v : bare ? v.replace(BARE, STARS) : v.replace(MONEY, `$1 ${STARS}`)
        if (shown === v) {
          m?.delete(a)
          continue
        }
        if (!m) attrs.set(el, (m = new Map()))
        m.set(a, { raw: v, shown })
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
      for (const el of root.querySelectorAll(ATTR_SEL)) doAttrs(el)
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = tw.nextNode(); n; n = tw.nextNode()) doText(n as Text)
    }

    // Showing: put every original back before the pass below forgets it.
    if (all) {
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const s = texts.get(n as Text)
        if (s && n.nodeValue === s.shown) n.nodeValue = s.raw
      }
      for (const el of document.body.querySelectorAll(ATTR_SEL)) {
        for (const [a, s] of attrs.get(el) ?? []) if (el.getAttribute(a) === s.shown) el.setAttribute(a, s.raw)
      }
    }
    walk(document.body)

    const obs = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') walk(r.target)
        else if (r.type === 'attributes') doAttrs(r.target as Element)
        else r.addedNodes.forEach(walk)
      }
    })
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
    const root = document.documentElement
    root.setAttribute('data-mask-ready', '')
    root.setAttribute('data-privacy', all ? 'shown' : 'hidden')

    // A click on any masked figure shows them all. The link or row it sits in
    // only follows on the next click, so peeking never navigates by accident.
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null
      const hit = target?.closest('[data-mask-hit]')
      if (all || !target || !hit || target.closest('.money-toggle')) return
      // A button or link that merely sits inside the figure's wrapper works as usual.
      const control = target.closest('a,button,input,select,textarea,label,summary,[role=button],[role=switch]')
      if (control && control !== hit && hit.contains(control)) return
      e.preventDefault()
      e.stopPropagation()
      setShown(true)
    }
    document.addEventListener('click', onClick, true)

    // Shown → hide again after IDLE_MS with no click, key, scroll or touch.
    let timer = 0
    const nudge = () => {
      touch()
      clearTimeout(timer)
      timer = window.setTimeout(() => setShown(false), IDLE_MS)
    }
    const activity = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    let tick = 0
    if (all) {
      nudge()
      for (const ev of activity) window.addEventListener(ev, nudge, { passive: true })
      tick = window.setInterval(hideIfExpired, 15_000)
      document.addEventListener('visibilitychange', hideIfExpired)
      window.addEventListener('pageshow', hideIfExpired)
    }

    return () => {
      obs.disconnect()
      document.removeEventListener('click', onClick, true)
      clearTimeout(timer)
      clearInterval(tick)
      for (const ev of activity) window.removeEventListener(ev, nudge)
      document.removeEventListener('visibilitychange', hideIfExpired)
      window.removeEventListener('pageshow', hideIfExpired)
    }
  }, [all])

  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-mask-ready')
      document.documentElement.removeAttribute('data-privacy')
    },
    [],
  )

  return (
    <>
      <span data-money-guard hidden />
      <span className="money-live" role="status" aria-live="polite">
        {all ? 'Amounts are showing. They hide again after 5 minutes idle.' : ''}
      </span>
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
