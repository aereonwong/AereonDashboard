import 'server-only'
import { Composio } from '@composio/core'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

// 👉 One way for the app's server to run a Composio tool (Canva, Google Drive)
// with NO model in the loop — the dashboard's invoice buttons go straight from
// here to the external API and back into the database.
//
// Two routes to the same tools, picked automatically:
//   • COMPOSIO_API_KEY set (Vercel)  → the Composio SDK, as the Instagram
//     refresh route already does. COMPOSIO_USER_ID picks the Composio user
//     whose Canva + Google Drive connections are used.
//   • running on this Mac, no key    → the Composio CLI Aereon is logged into,
//     the same trick as scripts/ig-refresh.mjs. Never used on Vercel.

const run = promisify(execFile)
const CLI = `${process.env.HOME ?? ''}/.local/bin/composio`

export class ComposioNotConfigured extends Error {
  constructor() {
    super('Canva / Google Drive are not connected on this server yet — add COMPOSIO_API_KEY in Vercel.')
  }
}

const apiKey = () => process.env.COMPOSIO_API_KEY?.trim()
const localCli = () => !process.env.VERCEL && !!process.env.HOME && existsSync(CLI)

/** Whether the invoice buttons that need Canva or Drive can work here at all. */
export const composioReady = () => !!apiKey() || localCli()

/** Run one tool and return its `data`. Throws with the tool's own error text. */
export async function composioExec<T = any>(slug: string, args: Record<string, unknown>): Promise<T> {
  const key = apiKey()
  if (key) {
    const composio = new Composio({ apiKey: key })
    const res = await composio.tools.execute(slug, {
      userId: process.env.COMPOSIO_USER_ID?.trim() || 'default',
      arguments: args,
      dangerouslySkipVersionCheck: true,
    })
    if (!res.successful) throw new Error(`${slug}: ${res.error ?? 'failed'}`)
    return res.data as T
  }
  if (!localCli()) throw new ComposioNotConfigured()

  const { stdout } = await run(CLI, ['execute', slug, '-d', JSON.stringify(args)], {
    maxBuffer: 1 << 26,
    env: { ...process.env, NO_COLOR: '1' },
  })
  const json = JSON.parse(stdout)
  if (json.successful === false) throw new Error(`${slug}: ${json.error ?? 'failed'}`)
  // Large results are written to a temp file instead of stdout.
  if (json.storedInFile && json.outputFilePath) {
    const stored = JSON.parse(await readFile(json.outputFilePath, 'utf8'))
    return (stored.data ?? stored) as T
  }
  return json.data as T
}
