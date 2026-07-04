import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listVariants } from '@/lib/vendor/variants'

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
  const variants = await listVariants(admin, res.offer.id)
  return NextResponse.json({ offer: res.offer, variants })
}

// PATCH — { action: 'accept' | 'decline' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { requestId } = await params
  const { action, variantId } = await req.json().catch(() => ({})) as { action?: string; variantId?: string }

  const admin = createAdminClient()
  const res = await loadVisibleOffer(admin, requestId, user.id)
  if ('forbidden' in res) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  if (!res.offer || res.offer.status === 'draft') return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })

  if (action === 'accept') {
    if (res.offer.status !== 'released') return NextResponse.json({ error: 'Angebot ist nicht offen' }, { status: 409 })

    // Varianten: hat das Angebot welche, muss genau eine gewaehlt werden. Die
    // gewaehlte Variante wird ins Angebot kopiert (Summen/Positionen) + markiert.
    const variants = await listVariants(admin, res.offer.id)
    const acceptPatch: Record<string, unknown> = {
      status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    let acceptedTotal = res.offer.total
    if (variants.length > 0) {
      const chosen = variants.find(v => v.id === variantId)
      if (!chosen) return NextResponse.json({ error: 'Bitte wähle eine Variante aus' }, { status: 400 })
      acceptPatch.line_items = chosen.line_items
      acceptPatch.subtotal = chosen.subtotal
      acceptPatch.tax_amount = chosen.tax_amount
      acceptPatch.total = chosen.total
      acceptedTotal = chosen.total
      await admin.from('vendor_offer_variants').update({ is_selected: false }).eq('offer_id', res.offer.id)
      await admin.from('vendor_offer_variants').update({ is_selected: true, updated_at: new Date().toISOString() }).eq('id', chosen.id)
    }

    const { error } = await admin.from('vendor_offers').update(acceptPatch).eq('id', res.offer.id)
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

    // Budget-Übernahme: angenommenes Angebot als Budget-Posten anlegen
    // (source_offer_id + Unique-Index verhindern Doppel-Übernahme).
    if (acceptedTotal != null && Number(acceptedTotal) > 0) {
      const { data: vendorProf } = await admin
        .from('dienstleister_profiles')
        .select('company_name, name, category')
        .eq('id', res.offer.dienstleister_id)
        .maybeSingle()
      const vendorName = vendorProf?.company_name || vendorProf?.name || 'Dienstleister'
      await admin.from('budget_items').insert({
        event_id: res.offer.event_id,
        category: vendorProf?.category ?? null,
        description: `${vendorName} — angenommenes Angebot (Forevr Marktplatz)`,
        planned: Number(acceptedTotal),
        source_offer_id: res.offer.id,
      })
      // Fehler (z.B. Unique-Konflikt bei erneuter Annahme) bewusst ignoriert —
      // die Annahme selbst darf daran nie scheitern.
    }

    // Sync CRM: mark contact as gebucht and set final deal_value
    if (res.offer.dienstleister_id) {
      await admin.from('crm_contacts')
        .update({
          deal_value: acceptedTotal ?? null,
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
