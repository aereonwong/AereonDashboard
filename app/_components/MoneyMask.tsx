'use client'

import { useEffect } from 'react'
import { hideIfExpired, setShown, touch } from './money-privacy'

// Privacy mode on screen. The server already disguises amounts while hidden
// (lib/privacy.ts) — this draws them as "RM *****" so no disguised figure is read as real, makes any masked figure (and any money edit control, data-money-edit)
// a way to show amounts, and while shown, keeps the 5-minute idle clock running.
// It works on the rendered page rather than on each formatter, so v1, v2, v3,
// charts, tooltips and any page added later are covered.
//
// How: after hydration it walks the page and rewrites the digits of anything
// that looks like money ("RM 0", "USD 0", "RM " + a number in the next text node,
// and any number inside an element marked data-money — chart axes that only say
// "40K"). React keeps owning the same text nodes, so when it writes a new value
// the observer simply masks that again.

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

export default function MoneyMask({ shown, canReveal }: { shown: boolean; canReveal: boolean }) {
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-privacy', shown ? 'shown' : 'hidden')
    root.toggleAttribute('data-privacy-owner', canReveal)
    root.setAttribute('data-mask-ready', '')

    // Shown: activity keeps the reveal cookie alive; once it lapses, reload hidden.
    if (shown) {
      const activity = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const
      for (const ev of activity) window.addEventListener(ev, touch, { passive: true })
      const tick = window.setInterval(hideIfExpired, 15_000)
      document.addEventListener('visibilitychange', hideIfExpired)
      window.addEventListener('pageshow', hideIfExpired)
      return () => {
        for (const ev of activity) window.removeEventListener(ev, touch)
        clearInterval(tick)
        document.removeEventListener('visibilitychange', hideIfExpired)
        window.removeEventListener('pageshow', hideIfExpired)
      }
    }

    const masked = new WeakMap<Text, string>()
    const maskedAttr = new WeakMap<Element, Map<string, string>>()

    const maskText = (raw: string, node: Text) => {
      if (node.parentElement?.closest('[data-money]')) return raw.replace(BARE, STARS)
      let out = raw.replace(MONEY, `$1 ${STARS}`)
      const prev = sibling(node, 'previousSibling')
      if (prev instanceof Text && TAIL.test(prev.nodeValue ?? '')) out = out.replace(LEAD, STARS)
      return out
    }

    const doText = (t: Text) => {
      const el = t.parentElement
      if (!el || el.closest(SKIP) || el.isContentEditable) return
      const v = t.nodeValue ?? ''
      if (masked.get(t) === v || !/\d/.test(v)) return
      const out = maskText(v, t)
      if (out === v) return
      masked.set(t, out)
      t.nodeValue = out
      el.setAttribute('data-mask-hit', '')
    }

    const doAttrs = (el: Element) => {
      if (el.closest(SKIP_ATTRS)) return
      const bare = !!el.closest('[data-money]')
      for (const a of ATTRS) {
        const v = el.getAttribute(a)
        if (v === null || maskedAttr.get(el)?.get(a) === v) continue
        const out = bare ? v.replace(BARE, STARS) : v.replace(MONEY, `$1 ${STARS}`)
        if (out === v) continue
        if (!maskedAttr.has(el)) maskedAttr.set(el, new Map())
        maskedAttr.get(el)!.set(a, out)
        el.setAttribute(a, out)
      }
    }

    const walk = (node: Node) => {
      if (node instanceof Text) {
        doText(node)
        const next = sibling(node, 'nextSibling')
        if (next instanceof Text) doText(next)
        return
      }
      if (!(node instanceof Element)) return
      doAttrs(node)
      for (const el of node.querySelectorAll(ATTR_SEL)) doAttrs(el)
      const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      for (let n = tw.nextNode(); n; n = tw.nextNode()) doText(n as Text)
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

    // A click on any masked figure, or on a control that edits money (its form would
    // hold disguised figures), shows amounts first — for the owner. Anyone else can't
    // show amounts, so for them only a money form's submit is stopped (the server
    // refuses it too). A button or link that merely sits inside a figure's wrapper
    // works as usual.
    const onClick = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null
      if (!target || target.closest('.money-toggle')) return
      if (!canReveal) {
        if (e.type === 'submit' && target.closest('[data-money-edit]')) {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
      const edit = target.closest('[data-money-edit]')
      const hit = target.closest('[data-mask-hit]')
      if (!edit && !hit) return
      if (!edit && hit) {
        const control = target.closest('a,button,input,select,textarea,label,summary,[role=button],[role=switch]')
        if (control && control !== hit && hit.contains(control)) return
      }
      e.preventDefault()
      e.stopPropagation()
      setShown(true)
    }
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-money-edit] :is(input, textarea, select)')) onClick(e)
    }
    // Another tab may have shown amounts, so the server would accept this form — but it was
    // drawn hidden and holds disguised figures. Never let it submit; redraw with the real figures first.
    const onSubmit = (e: SubmitEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-money-edit]')) onClick(e)
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('submit', onSubmit, true)

    return () => {
      obs.disconnect()
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [shown, canReveal])

  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-mask-ready')
      document.documentElement.removeAttribute('data-privacy')
      document.documentElement.removeAttribute('data-privacy-owner')
    },
    [],
  )

  return (
    <>
      {shown ? null : <span data-money-guard hidden />}
      <span className="money-live" role="status" aria-live="polite">
        {shown ? 'Amounts are showing. They hide again after 30 minutes idle.' : ''}
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
