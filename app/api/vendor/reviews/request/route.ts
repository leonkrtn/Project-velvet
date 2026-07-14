import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { sendReviewInvite } from '@/lib/vendor/automation-tick'

// GET — gebuchte Events des Vendors (accepted offer) inkl. Hinweis, ob schon eingeladen.
// Optional ?eventId= filtert auf ein einzelnes Event (z. B. für die Kontakt-Detailansicht im CRM).
export async function GET(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const filterEventId = req.nextUrl.searchParams.get('eventId')

  const { data: offers } = await admin.from('vendor_offers')
    .select('event_id').eq('dienstleister_id', vendorId).eq('status', 'accepted')
  let eventIds = Array.from(new Set((offers ?? []).map(o => o.event_id).filter(Boolean)))
  if (filterEventId) eventIds = eventIds.filter(id => id === filterEventId)
  if (eventIds.length === 0) return NextResponse.json({ events: [] })

  const [{ data: events }, { data: invites }] = await Promise.all([
    admin.from('events').select('id, couple_name, title, date').in('id', eventIds),
    admin.from('review_invites').select('event_id').eq('dienstleister_id', vendorId).in('event_id', eventIds),
  ])
  const invited = new Set((invites ?? []).map(i => i.event_id))
  const list = (events ?? []).map(e => ({
    id: e.id, name: e.couple_name || e.title || 'Event', date: e.date, invited: invited.has(e.id),
  })).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  return NextResponse.json({ events: list })
}

// POST — Bewertungsanfrage manuell senden. Body: { eventId }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { eventId } = await req.json().catch(() => ({})) as { eventId?: string }
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  // Berechtigung: Vendor muss ein angenommenes Angebot zu diesem Event haben.
  const { data: ok } = await admin.from('vendor_offers')
    .select('id').eq('dienstleister_id', vendorId).eq('event_id', eventId).eq('status', 'accepted').limit(1).maybeSingle()
  if (!ok) return NextResponse.json({ error: 'Keine abgeschlossene Zusammenarbeit zu diesem Event' }, { status: 403 })

  const sent = await sendReviewInvite(admin, vendorId, eventId)
  if (!sent) return NextResponse.json({ error: 'Einladung konnte nicht erstellt werden' }, { status: 500 })
  return NextResponse.json({ success: true })
}
