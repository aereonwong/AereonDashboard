import { NextResponse } from 'next/server'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { designIdOf, exportPdfUrl } from '@/lib/invoice-canva'
import { composioReady } from '@/lib/composio-exec'

// 👉 Preview. Always a fresh export from the Canva design (never the Drive copy,
// which an accountant may have moved or replaced), shown inline in the browser.
// The Canva design stays private: the server fetches it with Aereon's own
// connection and streams the PDF back, so only someone past the passcode gate
// (every /api route except the few listed in proxy.ts) can see it. No model
// is involved — one Composio call, then plain bytes.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!supabaseConfigured || !Number.isFinite(id)) return new NextResponse('Not found', { status: 404 })

  const { data: row } = await supabase.from('records').select('meta').eq('id', id).eq('category', 'cash_in').single()
  if (!row?.meta?.invoice_no) return new NextResponse('Invoice not found', { status: 404 })

  const designId = designIdOf(row)
  if (!designId) return new NextResponse('This invoice has no Canva design linked, so there is nothing to preview.', { status: 404 })
  if (!composioReady()) return new NextResponse('Canva is not connected on this server yet (COMPOSIO_API_KEY).', { status: 503 })

  try {
    const pdf = await fetch(await exportPdfUrl(designId), { cache: 'no-store' })
    if (!pdf.ok || !pdf.body) return new NextResponse(`Canva's PDF could not be fetched (${pdf.status}).`, { status: 502 })
    return new NextResponse(pdf.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${String(row.meta.invoice_no).replace(/[^\w.-]/g, '_')}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return new NextResponse(`Canva could not export the preview: ${e instanceof Error ? e.message : e}`, { status: 502 })
  }
}
