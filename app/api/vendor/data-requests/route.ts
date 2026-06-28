import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { ensureVendorConversation } from '@/lib/vendor/ensureChat'

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'feld'
}

// GET — eigene Daten-Anfragen zu einem Event. Query: ?eventId=
export async function GET(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const { data } = await admin.from('vendor_data_requests')
    .select('*').eq('dienstleister_id', vendorId).eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return NextResponse.json({ requests: data ?? [] })
}

// POST — neue Daten-Anfrage. Body: { eventId, fields: [{ label }] }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx
  const body = await req.json().catch(() => ({})) as { eventId?: string; fields?: { label?: string }[] }
  const eventId = body.eventId
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const fields = (body.fields ?? [])
    .map(f => (f.label ?? '').trim())
    .filter(Boolean)
    .slice(0, 15)
    .map(label => ({ key: slug(label), label, value: '' }))
  if (fields.length === 0) return NextResponse.json({ error: 'Bitte mindestens ein Feld angeben' }, { status: 400 })

  // Berechtigung: Vendor muss mit dem Event verknuepft sein (Anfrage oder Angebot).
  const { data: rel } = await admin.from('marketplace_requests')
    .select('id').eq('dienstleister_id', vendorId).eq('event_id', eventId).limit(1).maybeSingle()
  if (!rel) return NextResponse.json({ error: 'Kein Bezug zu diesem Event' }, { status: 403 })

  const conversationId = await ensureVendorConversation(admin, eventId, userId)

  const { data: row, error } = await admin.from('vendor_data_requests').insert({
    event_id: eventId, dienstleister_id: vendorId, conversation_id: conversationId, fields, status: 'open',
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (conversationId) {
    await admin.from('messages').insert({
      conversation_id: conversationId, event_id: eventId, sender_id: userId, message_type: 'text',
      content: `Datenanfrage: Bitte ergänzt im Portal — ${fields.map(f => f.label).join(', ')}.`,
    })
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
  }

  return NextResponse.json({ request: row })
}
