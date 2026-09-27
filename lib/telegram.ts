// 🔒 Don't edit — this keeps your robot safe.
// Minimal Telegram helpers. Read the bot token from env at call time (never
// inline it on a command line). Safe to call even before the token is set — they
// just no-op with a warning so the app doesn't crash.

const api = (method: string) => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  return token ? `https://api.telegram.org/bot${token}/${method}` : null
}

// ------------------------------------------------------------
// getFilePath() — step 1 of downloading a Telegram file (photo/PDF the user sent).
// Telegram gives you a file_id in the update; you ask getFile for a temporary
// file_path, then download it (step 2) — that path expires in ~1 hour, so the
// Vault pipeline downloads immediately. Returns null (never throws) so the caller
// can reply calmly if the token isn't set or Telegram says no.
// ------------------------------------------------------------
export async function getFilePath(
  fileId: string,
): Promise<{ file_path: string; file_size?: number } | null> {
  const url = api('getFile')
  if (!url) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok || !body.result?.file_path) {
      console.error('[CFO] getFile failed:', body.description || res.status)
      return null
    }
    return { file_path: body.result.file_path, file_size: body.result.file_size }
  } catch (e) {
    console.error('[CFO] getFile threw:', e)
    return null
  }
}

// ------------------------------------------------------------
// downloadFileBytes() — step 2: pull the actual bytes for a file_path from getFile.
// Returns a Buffer (or null on any error). Used by the Vault agent to hash + read +
// upload the receipt. Never throws.
// ------------------------------------------------------------
export async function downloadFileBytes(filePath: string): Promise<Buffer | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return null
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
    if (!res.ok) {
      console.error('[CFO] file download failed:', res.status)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.error('[CFO] file download threw:', e)
    return null
  }
}

// A single inline-keyboard button. `callback_data` is what the webhook receives
// when the user taps it — e.g. "apr:42" (approve action 42) / "rej:42".
export type InlineButton = { text: string; callback_data: string }
export type InlineKeyboard = InlineButton[][]

// Returns true if Telegram accepted the message (callers may ignore it).
export async function sendMessage(chatId: string | number, text: string): Promise<boolean> {
  const url = api('sendMessage')
  if (!url) {
    console.warn('[CFO] TELEGRAM_BOT_TOKEN not set yet — skipping sendMessage.')
    return false
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error('[CFO] Telegram sendMessage failed:', body.description || res.status)
  }
  return res.ok
}

// Send a message with Approve/Reject (or any) inline buttons. RETURNS the sent
// message_id so the caller can store it on the agent_actions row — the in-app
// approve path needs it to strip these same buttons via editMessageReplyMarkup.
// Returns null if the send failed or the token isn't set (caller degrades calmly).
export async function sendWithButtons(
  chatId: string | number,
  text: string,
  inlineKeyboard: InlineKeyboard,
): Promise<number | null> {
  const url = api('sendMessage')
  if (!url) {
    console.warn('[CFO] TELEGRAM_BOT_TOKEN not set yet — skipping sendWithButtons.')
    return null
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.ok) {
    console.error('[CFO] Telegram sendWithButtons failed:', body.description || res.status)
    return null
  }
  return body.result?.message_id ?? null
}

// Send a picture (by URL — Telegram fetches it itself) with a caption and
// buttons. Used for the invoice preview: the Canva thumbnail URL goes straight
// to Telegram, so the image never passes through this server.
export async function sendPhotoWithButtons(
  chatId: string | number,
  photoUrl: string,
  caption: string,
  inlineKeyboard: InlineKeyboard,
): Promise<boolean> {
  const url = api('sendPhoto')
  if (!url) return false
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.ok) console.error('[CFO] Telegram sendPhoto failed:', body.description || res.status)
  return !!(res.ok && body.ok)
}

// Acknowledge a button tap so Telegram stops the little spinner on the user's
// button. Optional toast text. Never throws.
export async function answerCallbackQuery(callbackId: string, text?: string) {
  const url = api('answerCallbackQuery')
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: text ?? '' }),
  }).catch(e => console.error('[CFO] answerCallbackQuery failed:', e))
}

// Strip (or replace) the inline buttons on an already-sent message. Pass no
// keyboard to remove them entirely — used after an action is decided so the same
// message can't be tapped twice. UX only; the CAS claim is the real guarantee.
export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  keyboard?: InlineKeyboard,
) {
  const url = api('editMessageReplyMarkup')
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard ? { inline_keyboard: keyboard } : {},
    }),
  }).catch(e => console.error('[CFO] editMessageReplyMarkup failed:', e))
}

// Who am I? The bot's own numeric id + @username, from getMe. Cached per server
// instance (it never changes for a token). Used to tell whether a group message is
// addressed to the bot. Returns null (never throws) if the token isn't set.
let botIdentity: { id: number; username: string } | null = null
export async function getBotIdentity(): Promise<{ id: number; username: string } | null> {
  if (botIdentity) return botIdentity
  const url = api('getMe')
  if (!url) return null
  try {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok || !body.result?.username) {
      console.error('[CFO] getMe failed:', body.description || res.status)
      return null
    }
    botIdentity = { id: body.result.id, username: body.result.username }
    return botIdentity
  } catch (e) {
    console.error('[CFO] getMe threw:', e)
    return null
  }
}
