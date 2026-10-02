'use client'

import { useEffect, useRef, useState } from 'react'
import type { IgPost } from '@/lib/instagram'
import Icon from '@/app/_components/Icon'
import Circle from './Circle'
import { compact, num } from './fmt'

// Top Instagram posts as frames. Clicking one opens Instagram's own player for
// it — reels play inline — using the stored permalink, which never expires.

const embed = (p: IgPost) => (p.permalink ? `${p.permalink.replace(/\/?$/, '/')}embed/` : null)
const isVideo = (p: IgPost) => /REEL|VIDEO/i.test(p.type)

export default function PostGrid({
  posts,
  limit = 6,
  circleFirst = false,
  lift,
}: {
  posts: IgPost[]
  limit?: number
  circleFirst?: boolean
  /** Reach as a multiple of the account's median post; shown when it is notable. */
  lift?: Record<string, number>
}) {
  const [open, setOpen] = useState<IgPost | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener.current?.focus()
    }
  }, [open])

  const shown = posts.slice(0, limit)
  if (!shown.length) return <p className="v3-empty">No posts in the latest Instagram snapshot yet.</p>

  return (
    <>
      <div className="v3-posts">
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="v3-post"
            onClick={e => {
              opener.current = e.currentTarget
              setOpen(p)
            }}
            aria-label={`${isVideo(p) ? 'Play reel' : 'Open post'}: ${p.caption.slice(0, 80)}. Reach ${num(p.reach ?? 0)}.`}
          >
            {p.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.thumb}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                data-crop={p.crop ? '' : undefined}
                style={
                  p.crop
                    ? ({
                        ['--crop-top' as string]: `${(-p.crop.t / (1 - p.crop.t - p.crop.b)) * 100}%`,
                        ['--crop-h' as string]: `${(1 / (1 - p.crop.t - p.crop.b)) * 100}%`,
                      } as React.CSSProperties)
                    : undefined
                }
              />
            ) : (
              <span className="v3-post-fallback">{p.caption.split('\n')[0].slice(0, 110)}</span>
            )}
            <span className="v3-post-shade" />
            <span className="v3-post-rank">#{i + 1}</span>
            {lift?.[p.id] !== undefined && (lift[p.id] >= 1.5 || lift[p.id] < 0.5) ? (
              <span className="v3-post-lift num" data-low={lift[p.id] < 0.5 || undefined} title="Reach compared with your typical (median) post">
                {lift[p.id] >= 10 ? Math.round(lift[p.id]) : lift[p.id].toFixed(1)}× typical
              </span>
            ) : null}
            {circleFirst && i === 0 ? <Circle drawn /> : null}
            <span className="v3-post-meta">
              <span className="v3-post-reach num">
                {compact(p.reach ?? 0)}
                <small>reach · {compact(p.views ?? 0)} views</small>
              </span>
              {isVideo(p) ? (
                <span className="v3-post-play" aria-hidden="true">
                  <Icon name="play" />
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      {open ? (
        <div className="v3-player" role="dialog" aria-modal="true" aria-label="Instagram post" onClick={() => setOpen(null)}>
          <div className="v3-player-box" onClick={e => e.stopPropagation()}>
            <div className="v3-player-bar">
              <span className="num">
                {num(open.reach ?? 0)} reach · {num(open.likes)} likes · {num(open.comments)} comments
                {open.saved !== undefined ? ` · ${num(open.saved)} saves` : ''}
                {open.shares !== undefined ? ` · ${num(open.shares)} shares` : ''}
                {open.watchMs !== undefined ? ` · ${(open.watchMs / 1000).toFixed(1)}s avg watch` : ''}
              </span>
              <button ref={closeRef} type="button" className="v3-player-close" onClick={() => setOpen(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            {embed(open) ? (
              <iframe src={embed(open)!} title="Instagram post" allow="autoplay; encrypted-media; picture-in-picture" loading="lazy" />
            ) : (
              <p className="v3-empty">This post has no link stored, so it cannot be played here.</p>
            )}
            {open.permalink ? (
              <div className="v3-player-bar">
                <a href={open.permalink} target="_blank" rel="noreferrer">
                  Open on Instagram ↗
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
