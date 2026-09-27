import { NextResponse } from 'next/server'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { driveOf, driveDownloadUrl } from '@/lib/invoice-drive'
import { designIdOf, exportPdfUrl } from '@/lib/invoice-canva'
import { composioReady } from '@/lib/composio-exec'

// 👉 Download PDF. The cheapest route that works, in order:
//   1. The invoice is already in Google Drive → redirect to that file. No API call.
//   2. Otherwise → one Canva export call, and redirect to Canva's own download
//      URL. The PDF streams from Canva to the browser; it never passes through
//      this server or any model.
// Behind the passcode gate like every other /api route except the few in proxy.ts.

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!supabaseConfigured || !Number.isFinite(id)) return new NextResponse('Not found', { status: 404 })

  const { data: row } = await supabase.from('records').select('meta').eq('id', id).eq('category', 'cash_in').single()
  if (!row?.meta?.invoice_no) return new NextResponse('Invoice not found', { status: 404 })

  const drive = driveOf(row)
  if (drive?.status === 'uploaded' && drive.file_id) return NextResponse.redirect(driveDownloadUrl(drive.file_id))

  const designId = designIdOf(row)
  if (!designId) return new NextResponse('This invoice has no Canva design linked, so there is no PDF to download.', { status: 404 })
  if (!composioReady()) return new NextResponse('Canva is not connected on this server yet (COMPOSIO_API_KEY).', { status: 503 })

  try {
    return NextResponse.redirect(await exportPdfUrl(designId))
  } catch (e) {
    return new NextResponse(`Canva could not export the PDF: ${e instanceof Error ? e.message : e}`, { status: 502 })
  }
}
