// Shared by scripts/expense-scan.mjs and scripts/expense-receipts.mjs: Composio CLI helpers for Gmail and Drive,
// run from this Mac through the Composio CLI Aereon is logged into (no API key, no model involved).
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`

/** Run one Composio tool; a result too big for stdout is read back from the file the CLI wrote. */
export async function exec(slug, data) {
  const { stdout } = await run(CLI, ['execute', slug, '-d', JSON.stringify(data)], { maxBuffer: 1 << 26, env: { ...process.env, NO_COLOR: '1' } })
  const json = JSON.parse(stdout)
  if (json.successful === false) throw new Error(`${slug}: ${json.error ?? 'failed'}`)
  if (json.storedInFile && json.outputFilePath) {
    const stored = JSON.parse(await readFile(json.outputFilePath, 'utf8'))
    return stored.data ?? stored
  }
  return json.data
}

/** Every message id matching a Gmail search, newest first. */
export async function searchIds(query, cap = 1000) {
  const ids = []
  let page
  do {
    const r = await exec('GMAIL_FETCH_EMAILS', { query, max_results: 100, ids_only: true, ...(page ? { page_token: page } : {}) })
    ids.push(...(r.messages ?? []).map(m => m.messageId))
    page = r.nextPageToken
  } while (page && ids.length < cap)
  return ids
}

export const getMessage = id => exec('GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID', { message_id: id, format: 'full' })

/** An email's body as plain lines: tags gone, entities decoded, blank lines squeezed. */
export function plain(html) {
  const text = String(html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|th|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
  return text.replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
}

/** The day an email arrived, in Malaysia (UTC+8), as YYYY-MM-DD. */
export const myDay = iso => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10)
