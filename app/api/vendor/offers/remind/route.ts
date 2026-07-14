import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { sendOfferReminder } from '@/lib/vendor/automation-tick'

// GET ?offerId= — Status eines Angebots (für die Aktionen-Anzeige im CRM).
export async function GET(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const offerId = req.nextUrl.searchParams.get('offerId')
  if (!offerId) return NextResponse.json({ error: 'offerId fehlt' }, { status: 400 })

  const { data: offer } = await admin.from('vendor_offers')
    .select('id, status, released_at')
    .eq('id', offerId).eq('dienstleister_id', vendorId).maybeSingle()
  if (!offer) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ status: offer.status, releasedAt: offer.released_at })
}

// POST — offenes (freigegebenes) Angebot manuell per Mail nachfassen. Body: { offerId }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { offerId } = await req.json().catch(() => ({})) as { offerId?: string }
  if (!offerId) return NextResponse.json({ error: 'offerId fehlt' }, { status: 400 })

  const result = await sendOfferReminder(admin, vendorId, offerId)
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: 'Angebot nicht gefunden',
      not_released: 'Nur freigegebene, noch offene Angebote können nachgefasst werden',
      no_event: 'Angebot ist mit keinem Event verknüpft',
      no_email: 'Keine E-Mail-Adresse des Brautpaars gefunden',
      no_template: 'E-Mail-Vorlage konnte nicht geladen werden',
    }
    return NextResponse.json({ error: messages[result.reason ?? ''] ?? 'Nachfassen fehlgeschlagen' }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
