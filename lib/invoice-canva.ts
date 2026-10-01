import 'server-only'
import type { Rec } from './records'
import { composioExec } from './composio-exec'
import { TEMPLATES, FOLDERS, invoiceYearFolders, buildOperations, type DocKind, type Operation } from './invoice-render'

// 👉 The Canva render, run by the app's own server instead of by Claude. The
// steps are exactly the ones documented at the top of lib/invoice-render.ts —
// copy the template, open an editing transaction, apply buildOperations(),
// commit — but executed through Composio's Canva MCP toolkit, so creating an
// invoice from the dashboard costs zero model tokens.
//
// The transaction is left OPEN after the edit: Canva hands back a thumbnail of
// the uncommitted result, which is the preview Aereon approves before anything
// is saved. Approve → commit + file into the year folder. Discard → cancel +
// park the copy in "TODO: Delete" (the API cannot delete a design outright).

const intent = 'Create an invoice from the Aereon Dashboard'

/** Composio's copy of the Canva tools names the target `element_id`; the MCP
 *  connector Claude uses calls the same id `locator_id`. Same ids, same ops. */
const forComposio = (ops: Operation[]) =>
  ops.map(({ locator_id, ...op }) => (locator_id ? { ...op, element_id: locator_id } : op))

export type RenderPreview = {
  designId: string
  transactionId: string
  previewUrl: string
  viewUrl?: string
  editUrl?: string
}

export async function startRender(rec: Rec, kind: DocKind = 'invoice'): Promise<RenderPreview> {
  const copy = await composioExec('CANVA_MCP_COPY_DESIGN', { design_id: TEMPLATES[kind], user_intent: intent })
  const design = copy?.design
  if (!design?.id) throw new Error('Canva did not return a copy of the template')

  try {
    const tx = await composioExec('CANVA_MCP_START_EDITING_TRANSACTION', { design_id: design.id, user_intent: intent })
    const transactionId = String(tx?.transaction?.transaction_id ?? '')
    if (!transactionId) throw new Error('Canva did not open an editing transaction')

    const edit = await composioExec('CANVA_MCP_PERFORM_EDITING_OPERATIONS', {
      transaction_id: transactionId,
      page_index: 1,
      pages: tx.pages,
      operations: forComposio(buildOperations(rec, kind)),
      user_intent: intent,
    })
    const failed = (edit?.edit_operation_results ?? []).filter((r: any) => r.status !== 'success')
    if (failed.length) {
      await cancelQuietly(transactionId)
      throw new Error(`Canva rejected ${failed.length} edit${failed.length === 1 ? '' : 's'}`)
    }

    return {
      designId: design.id,
      transactionId,
      previewUrl: String(edit?.thumbnails?.[0]?.url ?? tx?.thumbnails?.[0]?.url ?? ''),
      viewUrl: design.urls?.view_url,
      editUrl: design.urls?.edit_url,
    }
  } catch (e) {
    await parkForDeletion(design.id)
    throw e
  }
}

/** Save the previewed edit and file the design into its year folder. */
export async function commitRender(p: { designId: string; transactionId: string; invoiceDate: string; kind?: DocKind }) {
  await composioExec('CANVA_MCP_COMMIT_EDITING_TRANSACTION', { transaction_id: p.transactionId, user_intent: intent })
  await fileDesign(p.designId, p.invoiceDate, p.kind)
}

/** Move a design into its year folder. Tidy-up only — a committed design is
 *  already safe — so it never throws. Undo uses it to bring a parked design back. */
export async function fileDesign(designId: string, invoiceDate: string, kind: DocKind = 'invoice') {
  const folder = kind === 'quotation' ? FOLDERS.quotation : invoiceYearFolders[invoiceDate.slice(0, 4)] ?? FOLDERS.invoice
  await composioExec('CANVA_MCP_MOVE_ITEM_TO_FOLDER', { item_id: designId, to_folder_id: folder, user_intent: intent }).catch(() => {})
}

/** Throw the preview away: nothing saved, and the copy parked for deletion. */
export async function discardRender(p: { designId: string; transactionId: string }) {
  await cancelQuietly(p.transactionId)
  await parkForDeletion(p.designId)
}

async function cancelQuietly(transactionId: string) {
  await composioExec('CANVA_MCP_CANCEL_EDITING_TRANSACTION', { transaction_id: transactionId, user_intent: intent }).catch(() => {})
}

/** Park a design in "TODO: Delete" — the API cannot delete one outright. */
export async function parkForDeletion(designId: string) {
  await composioExec('CANVA_MCP_MOVE_ITEM_TO_FOLDER', {
    item_id: designId,
    to_folder_id: FOLDERS.todoDelete,
    user_intent: intent,
  }).catch(() => {})
}

/** A fresh, short-lived PDF download URL from Canva's own exporter. One call;
 *  the bytes go straight from Canva to whoever opens the URL. */
export async function exportPdfUrl(designId: string): Promise<string> {
  const res = await composioExec('CANVA_MCP_EXPORT_DESIGN', {
    design_id: designId,
    format: { type: 'pdf', size: 'a4' },
    user_intent: 'Download an invoice PDF',
  })
  const url = res?.job?.urls?.[0]
  if (!url) throw new Error(`Canva export did not finish (${res?.job?.status ?? 'no job'})`)
  return String(url)
}

/** The Canva design behind a filed invoice, from whichever field recorded it:
 *  the Canva import wrote `canva_design`, the bot writes `render.design_id`,
 *  and a /design/<id>/ URL carries it too. Short share links (canva.com/d/…)
 *  don't, so those rows have no id until one is recorded. */
export function designIdOf(r: Pick<Rec, 'meta'>): string | undefined {
  const m = r.meta ?? {}
  const direct = m.canva_design ?? m.render?.design_id
  if (direct) return String(direct)
  const fromUrl = String(m.canva_url ?? '').match(/\/design\/(D[A-Za-z0-9_-]{10})\b/)
  return fromUrl?.[1]
}
