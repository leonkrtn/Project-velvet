import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptMarketplaceRequest } from '@/lib/marketplace/accept'

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
      await admin.from('event_members')
        .delete()
        .eq('event_id', request.event_id)
        .eq('role', 'dienstleister')
        .in('user_id', vendorUserIds)
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

    const conversationId = await acceptMarketplaceRequest(admin, request, user.id)
    return NextResponse.json({ success: true, conversationId })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
