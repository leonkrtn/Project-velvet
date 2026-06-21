import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { loadFullQuestionnaire } from '@/lib/vendor/load'
import { computeOffer, type StandardInfo } from '@/lib/vendor/pricing'
import { buildOfferPatch, loadOwnedOffer } from '@/lib/vendor/offer-service'
import { ensureVendorConversation } from '@/lib/vendor/ensureChat'
import { acceptMarketplaceRequest } from '@/lib/marketplace/accept'
import { notifyOfferReleased } from '@/lib/vendor/offer-notify'
import type { Answer } from '@/lib/vendor/questionnaire'

// GET — vollstaendiges eigenes Angebot.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { offerId } = await params
  const offer = await loadOwnedOffer(admin, offerId, vendorId)
  if (!offer) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  return NextResponse.json({ offer })
}

// PATCH — { action: 'save'|'recompute'|'release'|'supersede', ...editFields }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx
  const { offerId } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = body.action as string

  const offer = await loadOwnedOffer(admin, offerId, vendorId)
  if (!offer) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  if (offer.status === 'accepted') return NextResponse.json({ error: 'Angebot wurde bereits angenommen' }, { status: 409 })

  // Neu aus Fragebogen-Preislogik berechnen (verwirft manuelle Edits).
  if (action === 'recompute') {
    const q = await loadFullQuestionnaire(admin, vendorId)
    if (!q) return NextResponse.json({ error: 'Kein Fragebogen vorhanden' }, { status: 400 })
    const totals = computeOffer(q, (offer.answers as Answer[]) ?? [], (offer.standard_info as StandardInfo) ?? {})
    const { error } = await admin.from('vendor_offers').update({
      line_items: totals.lineItems, subtotal: totals.subtotal,
      tax_mode: totals.taxMode, tax_rate: totals.taxRate, tax_amount: totals.taxAmount,
      total: totals.total, currency: totals.currency, valid_until: totals.validUntil,
      footer_note: totals.footerNote, updated_at: new Date().toISOString(),
    }).eq('id', offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Neue Version erstellen: aktuelles Angebot wird ersetzt, Kopie als Entwurf.
  if (action === 'supersede') {
    const root = (offer.parent_offer_id as string) || offer.id
    const { data: dup, error: dupErr } = await admin.from('vendor_offers').insert({
      event_id: offer.event_id, dienstleister_id: vendorId, created_by: userId,
      status: 'draft', request_id: offer.request_id, conversation_id: offer.conversation_id,
      parent_offer_id: root, version: (offer.version ?? 1) + 1,
      title: offer.title, answers: offer.answers, standard_info: offer.standard_info,
      line_items: offer.line_items, subtotal: offer.subtotal, tax_mode: offer.tax_mode,
      tax_rate: offer.tax_rate, tax_amount: offer.tax_amount, total: offer.total,
      currency: offer.currency, valid_until: offer.valid_until, footer_note: offer.footer_note,
      vendor_notes: offer.vendor_notes, deposit_type: offer.deposit_type, deposit_value: offer.deposit_value,
      deposit_due_days: offer.deposit_due_days, balance_due_note: offer.balance_due_note,
      payment_terms: offer.payment_terms, agb_text: offer.agb_text, agb_required: offer.agb_required,
    }).select('id').single()
    if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 })
    await admin.from('vendor_offers').update({ status: 'superseded', updated_at: new Date().toISOString() }).eq('id', offer.id)
    return NextResponse.json({ success: true, id: dup.id })
  }

  const patch = buildOfferPatch(body, offer)

  if (action === 'release') {
    // Chat sicherstellen — bei Marktplatz-Anfrage ueber accept(), sonst direkt.
    let conversationId: string | null = (offer.conversation_id as string | null) ?? null
    if (offer.request_id) {
      const { data: request } = await admin
        .from('marketplace_requests')
        .select('id, event_id, dienstleister_id, requested_by, status, message, conversation_id')
        .eq('id', offer.request_id).maybeSingle()
      if (request) {
        conversationId = (request.conversation_id as string | null)
          ?? (request.status === 'pending' ? await acceptMarketplaceRequest(admin, request, userId) : null)
      }
    }
    if (!conversationId) conversationId = await ensureVendorConversation(admin, offer.event_id, userId)

    patch.status = 'released'
    patch.released_at = new Date().toISOString()
    patch.conversation_id = conversationId
    const { error } = await admin.from('vendor_offers').update(patch).eq('id', offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: fresh } = await admin
      .from('vendor_offers')
      .select('id, event_id, dienstleister_id, conversation_id, request_id, title, total, currency')
      .eq('id', offer.id).maybeSingle()
    if (fresh) await notifyOfferReleased(admin, fresh as never, userId)

    return NextResponse.json({ success: true, conversationId })
  }

  if (action === 'save') {
    const { error } = await admin.from('vendor_offers').update(patch).eq('id', offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}

// DELETE — nur Entwuerfe loeschbar.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { offerId } = await params
  const offer = await loadOwnedOffer(admin, offerId, vendorId)
  if (!offer) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  if (offer.status !== 'draft') return NextResponse.json({ error: 'Nur Entwürfe können gelöscht werden' }, { status: 409 })
  const { error } = await admin.from('vendor_offers').delete().eq('id', offer.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
