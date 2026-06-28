import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { buildOfferPdfData } from '@/lib/vendor/offer-pdf-data'
import { renderOfferPdf } from '@/lib/vendor/offer-pdf'
import { applyVariantToOffer, type OfferVariant } from '@/lib/vendor/variants'

export const runtime = 'nodejs'

// GET — Angebots-PDF fuer den Dienstleister (jeder Status). ?variantId= rendert eine Variante.
export async function GET(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId } = await params

  const { data: offer } = await admin.from('vendor_offers').select('*').eq('request_id', requestId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) {
    return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  }

  let pdfOffer = offer
  const variantId = req.nextUrl.searchParams.get('variantId')
  if (variantId) {
    const { data: variant } = await admin.from('vendor_offer_variants').select('*').eq('id', variantId).maybeSingle()
    if (variant && variant.offer_id === offer.id) pdfOffer = applyVariantToOffer(offer, variant as OfferVariant)
  }

  const pdf = await renderOfferPdf(await buildOfferPdfData(admin, pdfOffer))
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Angebot-${requestId.slice(0, 8)}.pdf"`,
    },
  })
}
