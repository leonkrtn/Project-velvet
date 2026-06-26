import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

const REQUESTER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function loadVisibleOffer(admin: SupabaseClient, requestId: string, userId: string) {
  const { data: offer } = await admin.from('vendor_offers').select('*').eq('request_id', requestId).maybeSingle()
  if (!offer) return { offer: null as null }
  const { data: member } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', offer.event_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!member || !REQUESTER_ROLES.includes(member.role)) return { forbidden: true as const }
  return { offer }
}

// GET — Angebot zur Anfrage fuer das Brautpaar (nur ab Status 'released').
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { requestId } = await params

  const admin = createAdminClient()
  const res = await loadVisibleOffer(admin, requestId, user.id)
  if ('forbidden' in res) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  if (!res.offer || res.offer.status === 'draft') return NextResponse.json({ offer: null })
  return NextResponse.json({ offer: res.offer })
}

// PATCH — { action: 'accept' | 'decline' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { requestId } = await params
  const { action } = await req.json().catch(() => ({})) as { action?: string }

  const admin = createAdminClient()
  const res = await loadVisibleOffer(admin, requestId, user.id)
  if ('forbidden' in res) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  if (!res.offer || res.offer.status === 'draft') return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })

  if (action === 'accept') {
    if (res.offer.status !== 'released') return NextResponse.json({ error: 'Angebot ist nicht offen' }, { status: 409 })
    const { error } = await admin.from('vendor_offers')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', res.offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Bestaetigung in den Chat posten, damit der Dienstleister es sieht.
    const { data: reqRow } = await admin
      .from('marketplace_requests').select('conversation_id').eq('id', requestId).maybeSingle()
    if (reqRow?.conversation_id) {
      await admin.from('messages').insert({
        conversation_id: reqRow.conversation_id,
        event_id: res.offer.event_id,
        sender_id: user.id,
        content: 'Das Angebot wurde angenommen.',
        message_type: 'text',
      })
      await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', reqRow.conversation_id)
    }

    // Sync CRM: mark contact as gebucht and set final deal_value
    if (res.offer.dienstleister_id) {
      await admin.from('crm_contacts')
        .update({
          deal_value: res.offer.total ?? null,
          pending_offer_value: null,
          lifecycle_stage: 'gebucht',
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId)
        .eq('dienstleister_id', res.offer.dienstleister_id)
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'decline') {
    if (res.offer.status !== 'released') return NextResponse.json({ error: 'Angebot ist nicht offen' }, { status: 409 })
    const { error } = await admin.from('vendor_offers')
      .update({ status: 'declined', declined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', res.offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
