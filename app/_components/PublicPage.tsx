import type { Metadata } from 'next'
import { PAGES, EMAIL, SITE_NAME, OG_IMAGE, type PublicPage as Page } from '@/lib/agent-site'

// One shell for the public trust pages (about / contact / privacy). Content comes from
// lib/agent-site.ts, the same source the Markdown twins are built from.
export const pageMetadata = (page: Page): Metadata => ({
  title: page.title.includes(SITE_NAME) ? page.title : `${page.title} — ${SITE_NAME}`,
  description: page.description,
  alternates: { canonical: page.path },
  openGraph: {
    type: 'website',
    title: page.title,
    description: page.description,
    url: page.path,
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height }],
  },
})

export default function PublicPage({ page }: { page: Page }) {
  return (
    <div className="land">
      <div className="land-photo" aria-hidden="true" />
      <div className="land-scrim" aria-hidden="true" />
      <div className="land-inner">
        <header className="land-top">
          <a className="land-mark" href="/" style={{ color: '#fff', textDecoration: 'none' }}>
            <span className="dotmark" aria-hidden="true" /> {SITE_NAME}
          </a>
          <nav className="pub-nav" aria-label="Public pages">
            {PAGES.map(p => (
              <a key={p.slug} href={p.path} aria-current={p.slug === page.slug ? 'page' : undefined}>
                {p.slug}
              </a>
            ))}
          </nav>
        </header>
        <main className="pub-body">
          <h1>{page.title}</h1>
          {page.sections.map(s => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.body.map(t => (
                <p key={t}>{t}</p>
              ))}
            </section>
          ))}
          <p>
            <a className="land-btn solid" href={`mailto:${EMAIL}`}>Email the studio</a>
          </p>
        </main>
      </div>
    </div>
  )
}
