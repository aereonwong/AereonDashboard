import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readHello } from '@/lib/hello'
import { latestAccount, ninety } from '@/lib/instagram'
import { socials, combined } from '@/lib/socials'

// 👉 The preview card when aereonwong.com/hello is shared (WhatsApp, DMs, X, Facebook):
// the KLCC sunset, the round portrait, name, tagline and the same proof numbers as the
// page (90-day Instagram views + interactions from the stored snapshot, combined followers).
// Rebuilt at most every 6 hours; apps cache previews for days anyway.

export const alt = 'Aereon Wong — tech & travel creator and drone pilot in Kuala Lumpur'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 21600

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1_000 ? `${Math.round(n / 1000)}K` : String(n)

const dataUri = async (file: string) =>
  `data:image/jpeg;base64,${(await readFile(join(process.cwd(), 'public/img', file))).toString('base64')}`

export default async function Image() {
  const [bg, face, cfg, account] = await Promise.all([
    dataUri('klcc-sunset.jpg'), dataUri('aereon.jpg'), readHello(), latestAccount().catch(() => null),
  ])
  const fresh = account && Date.now() - new Date(account.captured_at).getTime() < 7 * 86_400_000
  const d90 = fresh ? ninety(account) : null
  const channels = socials()
  const stats = [
    d90?.views ? { n: compact(d90.views), l: 'Views · 90 days' } : null,
    d90?.interactions ? { n: compact(d90.interactions), l: 'Interactions · 90 days' } : null,
    { n: compact(combined(channels)), l: `Followers · ${channels.length} platforms` },
  ].filter(Boolean) as { n: string; l: string }[]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#0B0D12', color: '#F5F5F7' }}>
        <img src={bg} width={1200} height={800} style={{ position: 'absolute', top: -110, left: 330, width: 1200, height: 800, objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', backgroundImage: 'linear-gradient(90deg, rgba(11,13,18,1) 0%, rgba(11,13,18,0.92) 50%, rgba(11,13,18,0.25) 72%, rgba(11,13,18,0) 100%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px', width: 760 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <img src={face} width={150} height={150} style={{ width: 150, height: 150, borderRadius: 75, objectFit: 'cover', objectPosition: '50% 20%', border: '4px solid #F4B860' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05 }}>Aereon Wong</div>
              <div style={{ fontSize: 26, color: 'rgba(245,245,247,0.75)', marginTop: 10, maxWidth: 480 }}>{cfg.tagline}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 44 }}>
            {stats.map(s => (
              <div key={s.l} style={{ display: 'flex', flexDirection: 'column', padding: '18px 22px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)', minWidth: 190 }}>
                <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{s.n}</div>
                <div style={{ fontSize: 19, color: 'rgba(245,245,247,0.62)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 24, color: '#F4B860', fontWeight: 600 }}>
            Brand collabs · Photo & video · Drone pilot
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
