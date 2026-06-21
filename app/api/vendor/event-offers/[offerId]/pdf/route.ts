import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { buildOfferPdfData } from '@/lib/vendor/offer-pdf-data'
import { renderOfferPdf } from '@/lib/vendor/offer-pdf'
import { loadOwnedOffer } from '@/lib/vendor/offer-service'

export const runtime = 'nodejs'

// GET — Angebots-PDF fuer den Dienstleister (jeder Status).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { offerId } = await params

  const offer = await loadOwnedOffer(admin, offerId, vendorId)
  if (!offer) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })

  const pdf = await renderOfferPdf(await buildOfferPdfData(admin, offer))
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Angebot-${offerId.slice(0, 8)}.pdf"`,
    },
  })
}
