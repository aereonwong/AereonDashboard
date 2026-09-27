import { getSetting } from './settings'

// 👉 Filing a rendered invoice PDF: the two facts that can change on their own
// (which Drive folder it lands in, what the filename looks like) live in the
// `invoice_export` setting, not hard-coded here — change the folder by writing
// a new value with `setSetting`, not by editing code or a PR.
//
// The transfer itself is server-to-server and needs no local download: Canva's
// `export-design` returns a presigned download URL, and Google Drive's own
// `GOOGLEDRIVE_UPLOAD_FROM_URL` (via Composio) fetches straight from that URL.
// No PDF bytes ever pass through Claude or this app — that's what makes the
// whole step near-free once the Canva design itself is committed.

export type InvoiceExportConfig = {
  /** Google Drive folder every finished invoice PDF is filed into. Aereon's
   *  accountant checks this folder and moves each PDF into its own year
   *  folder from here — so Claude never sorts by year on this side. */
  driveFolderId: string
  driveFolderName: string
}

const DEFAULT_CONFIG: InvoiceExportConfig = {
  driveFolderId: '1NQJsEAXTN6iSiuiNG_DhQ7aeUU2b9srW', // "SYCP Client Invoice"
  driveFolderName: 'SYCP Client Invoice',
}

export async function getInvoiceExportConfig(): Promise<InvoiceExportConfig> {
  return getSetting('invoice_export', DEFAULT_CONFIG)
}

/** "SYCP-202609-013 - KLCC Projection Mapping and Fireworks.pdf" — the same
 *  name already used across the Drive folder's back catalogue. */
export function exportFilename(invoiceNo: string, job: string): string {
  return `${invoiceNo} - ${job}.pdf`
}
