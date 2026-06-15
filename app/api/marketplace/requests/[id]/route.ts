import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH — Anfrage bearbeiten.
//   Vendor:    { action: 'accept' | 'decline' }
//   Brautpaar: { action: 'cancel' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { action?: string; reason?: string }
  const { action } = body

  const admin = createAdminClient()
  const { data: request } = await admin
    .from('marketplace_requests')
    .select('id, event_id, dienstleister_id, requested_by, status, message')
    .eq('id', id)
    .maybeSingle()
  if (!request) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })

  // Ist der Aufrufer der Vendor dieser Anfrage?
  const { data: vendorLink } = await admin
    .from('user_dienstleister')
    .select('user_id')
    .eq('dienstleister_id', request.dienstleister_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const isVendor = !!vendorLink

  // Ist der Aufrufer Event-Mitglied (Brautpaar/Veranstalter)?
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', request.event_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const isMember = !!member

  if (action === 'cancel') {
    if (!isMember) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    if (request.status !== 'pending') return NextResponse.json({ error: 'Anfrage ist nicht mehr offen' }, { status: 409 })
    await admin.from('marketplace_requests').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action === 'end') {
    // Bereits angenommene Zusammenarbeit beenden — Begründung erforderlich.
    if (!isMember) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    if (request.status !== 'accepted') return NextResponse.json({ error: 'Anfrage ist nicht angenommen' }, { status: 409 })
    const bodyReason = (body.reason ?? '').trim()
    if (!bodyReason) return NextResponse.json({ error: 'Bitte einen Grund angeben' }, { status: 400 })

    await admin.from('marketplace_requests')
      .update({ status: 'cancelled', cancel_reason: bodyReason, responded_at: new Date().toISOString() })
      .eq('id', id)

    // Verknüpfung + Berechtigungen des Vendors für dieses Event entfernen
    const { data: vendorLinkUser } = await admin
      .from('user_dienstleister')
      .select('user_id')
      .eq('dienstleister_id', request.dienstleister_id)
    const vendorUserIds = (vendorLinkUser ?? []).map(l => (l as { user_id: string }).user_id)
    await admin.from('event_dienstleister')
      .delete()
      .eq('event_id', request.event_id)
      .eq('dienstleister_id', request.dienstleister_id)
    if (vendorUserIds.length) {
      await admin.from('dienstleister_permissions')
        .delete()
        .eq('event_id', request.event_id)
        .in('dienstleister_user_id', vendorUserIds)
    }
    return NextResponse.json({ success: true })
  }

  if (action === 'decline') {
    if (!isVendor) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    if (request.status !== 'pending') return NextResponse.json({ error: 'Anfrage ist nicht mehr offen' }, { status: 409 })
    await admin.from('marketplace_requests').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action === 'accept') {
    if (!isVendor) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    if (request.status !== 'pending') return NextResponse.json({ error: 'Anfrage ist nicht mehr offen' }, { status: 409 })

    const { data: vendorProfile } = await admin
      .from('dienstleister_profiles')
      .select('category, name, company_name')
      .eq('id', request.dienstleister_id)
      .maybeSingle()

    // 1. event_dienstleister verknüpfen (idempotent über UNIQUE(event_id, dienstleister_id))
    await admin.from('event_dienstleister').upsert({
      event_id: request.event_id,
      dienstleister_id: request.dienstleister_id,
      user_id: user.id,
      category: vendorProfile?.category ?? 'sonstiges',
      status: 'akzeptiert',
      invited_by: request.requested_by,
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'event_id,dienstleister_id' })

    // 2. Sinnvolle Default-Berechtigungen (Übersicht lesen, Chat schreiben)
    await admin.from('dienstleister_permissions').upsert([
      { event_id: request.event_id, dienstleister_user_id: user.id, tab_key: 'uebersicht', item_id: null, access: 'read' },
      { event_id: request.event_id, dienstleister_user_id: user.id, tab_key: 'chats', item_id: null, access: 'write' },
    ], { onConflict: 'event_id,dienstleister_user_id,tab_key,item_id' })

    // 3. Chat eröffnen (Vendor ↔ anfragendes Brautpaar)
    let conversationId: string | null = null
    const otherUser = request.requested_by
    const vendorName = vendorProfile?.company_name || vendorProfile?.name || 'Dienstleister'
    const { data: conv } = await admin
      .from('conversations')
      .insert({ event_id: request.event_id, name: `Anfrage · ${vendorName}`, created_by: user.id })
      .select('id')
      .single()
    if (conv) {
      conversationId = conv.id
      const participants = [{ conversation_id: conv.id, user_id: user.id }]
      if (otherUser && otherUser !== user.id) participants.push({ conversation_id: conv.id, user_id: otherUser })
      await admin.from('conversation_participants').insert(participants)
      // Erste Nachricht mit dem Anfragetext
      if (request.message) {
        await admin.from('messages').insert({
          conversation_id: conv.id, event_id: request.event_id,
          sender_id: otherUser ?? user.id, content: request.message,
        })
      }
    }

    await admin.from('marketplace_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString(), conversation_id: conversationId })
      .eq('id', id)

    return NextResponse.json({ success: true, conversationId })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
