import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { buildOfferPdfData } from '@/lib/vendor/offer-pdf-data'
import { renderOfferPdf } from '@/lib/vendor/offer-pdf'

export const runtime = 'nodejs'

// GET — Angebots-PDF fuer den Dienstleister (jeder Status).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId } = await params

  const { data: offer } = await admin.from('vendor_offers').select('*').eq('request_id', requestId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) {
    return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  }

  const pdf = await renderOfferPdf(await buildOfferPdfData(admin, offer))
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Angebot-${requestId.slice(0, 8)}.pdf"`,
    },
  })
}
