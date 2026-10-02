import Anthropic from '@anthropic-ai/sdk'
import { safeEqual } from '@/lib/session'
import { sendMessage } from '@/lib/telegram'
import { logRun } from '@/lib/runs'
import { parseDigest, saveNews } from '@/lib/news'

// 👉 The daily tech + travel news digest (the 2nd Vercel Hobby cron slot).
// Every morning at 9:00 Malaysia time Claude searches the web for the last 24 hours
// of tech and travel news and texts the OWNER a short digest — owner only, never the
// team group. Read-only: it searches and reports, it never acts on your records.
//
// AUTH FAILS CLOSED, same as /api/cron-daily: no CRON_SECRET ⇒ 401 to everyone.
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // web research takes a while

// 👉 Who the digest is for — edit to steer the topics.
const AUDIENCE =
  'Aereon Wong, a Kuala Lumpur-based travel and tech content creator and professional drone ' +
  'photographer (drone shoots, travel and tourism campaigns, gadget and phone launches, hotels).'

// Telegram caps one message at 4,096 characters; split on paragraph breaks below that.
const LIMIT = 3800

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authed = !!secret && safeEqual(req.headers.get('authorization'), `Bearer ${secret}`)
  if (!authed) return new Response('forbidden', { status: 401 })

  const owner = process.env.OWNER_CHAT_ID?.trim()
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!owner || !apiKey) {
    return Response.json({ ok: false, error: 'OWNER_CHAT_ID or ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const now = new Date()
  const myt = (d: Date) =>
    d.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })
  const windowText = `${myt(new Date(now.getTime() - 86_400_000))} to ${myt(now)} (Malaysia time)`

  let digest: string
  try {
    digest = await research(apiKey, windowText)
  } catch (e) {
    console.error('[CFO] news digest failed:', e)
    await logRun('news-digest', 'failed', { error: String(e) })
    await sendMessage(owner, '📰 Today\'s tech & travel digest hit a snag — it\'s logged. It will try again tomorrow.')
    return Response.json({ ok: false }, { status: 500 })
  }

  // Keep the stories for the News page. The Telegram send below never depends on
  // this: a missing table or a parse miss is logged, and the digest still goes out.
  const digestDate = new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) // Malaysia date
  let saved = 0
  try {
    const res = await saveNews(parseDigest(digest, digestDate))
    saved = res.count
    if (!res.ok) console.warn('[CFO] news not saved:', res.error)
  } catch (e) {
    console.warn('[CFO] news save threw:', e)
  }

  const parts = chunk(`📰 <b>Tech &amp; Travel — last 24h</b>\n<i>${windowText}</i>\n\n${digest}`)
  let sent = 0
  for (const p of parts) {
    // If Telegram rejects the HTML, resend the same text as plain (escaped) text.
    if ((await sendMessage(owner, p)) || (await sendMessage(owner, toPlain(p)))) sent++
  }
  await logRun('news-digest', sent === parts.length ? 'ok' : 'failed', { parts: parts.length, sent, saved })
  return Response.json({ ok: sent === parts.length, parts: parts.length, sent, saved })
}

// One Claude call with the web search server tool. Server tools can pause a long
// turn (stop_reason "pause_turn"); we resend the conversation to let it continue.
async function research(apiKey: string, windowText: string): Promise<string> {
  const client = new Anthropic({ apiKey })
  const system =
    `You write a daily news digest for ${AUDIENCE}\n` +
    `Use web search to find the most important TECH and TRAVEL news published in this window: ${windowText}. ` +
    `Only include stories you can confirm were published in that window; skip anything older.\n` +
    `Format for Telegram HTML — only <b>, <i> and <a href="..."> tags, no markdown, no headings with #. Sections:\n` +
    `💻 <b>Tech</b> — 4-6 items (AI, phones, cameras, drones, creator tools, big platform changes)\n` +
    `✈️ <b>Travel</b> — 4-6 items (airlines, tourism, destinations, travel tech, visas)\n` +
    `🇲🇾 <b>Malaysia &amp; SEA</b> — 2-4 items relevant to Malaysia or Southeast Asia\n` +
    `💡 <b>Content angles</b> — 2-3 short ideas he could film or post from today's news\n` +
    `Each item: one bullet "• <b>headline</b> — one sentence on why it matters. <a href="URL">Source</a>". ` +
    `Escape & as &amp; in text. Keep the whole digest under 3,500 characters. Output only the digest.`

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: 'Write today\'s digest.' },
  ]
  for (let round = 0; round < 4; round++) {
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }],
      messages,
      // If a safety classifier declines, the API retries on a fallback model itself.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as any)
    const res = await stream.finalMessage()
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content })
      continue
    }
    if (res.stop_reason === 'refusal') throw new Error('model declined the request')
    const text = res.content
      .filter((c): c is Anthropic.Beta.BetaTextBlock => c.type === 'text')
      .map(c => c.text)
      .join('')
      .trim()
    if (!text) throw new Error(`empty digest (stop_reason ${res.stop_reason})`)
    return text
  }
  throw new Error('digest did not finish after 4 rounds')
}

function chunk(text: string): string[] {
  const out: string[] = []
  let cur = ''
  for (const para of text.split('\n\n')) {
    const next = cur ? `${cur}\n\n${para}` : para
    if (next.length > LIMIT && cur) {
      out.push(cur)
      cur = para
    } else {
      cur = next
    }
  }
  if (cur) out.push(cur)
  return out.map(p => (p.length > LIMIT ? p.slice(0, LIMIT) : p))
}

// Strip tags and escape the three HTML-special characters so parse_mode HTML accepts it.
function toPlain(html: string): string {
  return html
    .replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
