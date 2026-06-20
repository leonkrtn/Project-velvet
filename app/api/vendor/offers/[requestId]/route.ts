import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { acceptMarketplaceRequest } from '@/lib/marketplace/accept'
import { loadFullQuestionnaire } from '@/lib/vendor/load'
import { computeOffer, recomputeTotals, type LineItem } from '@/lib/vendor/pricing'
import type { Answer, TaxMode } from '@/lib/vendor/questionnaire'
import type { SupabaseClient } from '@supabase/supabase-js'

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function sanitizeLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((li: Record<string, unknown>) => {
    const qty = num(li.qty)
    const unitPrice = num(li.unitPrice)
    // total respektieren, wenn explizit gesetzt; sonst qty*unitPrice.
    const total = li.total != null && li.total !== '' ? num(li.total) : Math.round(qty * unitPrice * 100) / 100
    return { label: (li.label as string)?.trim() || 'Position', qty, unitPrice, total }
  })
}

async function loadOwnedOffer(requestId: string, vendorId: string, admin: SupabaseClient) {
  const { data: offer } = await admin.from('vendor_offers').select('*').eq('request_id', requestId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) return null
  return offer
}

// GET — eigenes Angebot zur Anfrage.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId } = await params

  const offer = await loadOwnedOffer(requestId, vendorId, admin)
  if (!offer) return NextResponse.json({ offer: null })
  return NextResponse.json({ offer })
}

// PATCH — { action: 'save' | 'recompute' | 'release', lineItems?, vendorNotes?, validUntil? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx
  const { requestId } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = body.action as string

  const offer = await loadOwnedOffer(requestId, vendorId, admin)
  if (!offer) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  if (offer.status === 'accepted') return NextResponse.json({ error: 'Angebot wurde bereits angenommen' }, { status: 409 })

  const taxMode = offer.tax_mode as TaxMode
  const opts = {
    taxMode, taxRate: num(offer.tax_rate), currency: offer.currency ?? 'EUR',
    validUntil: (offer.valid_until as string | null) ?? null, footerNote: offer.footer_note ?? '',
  }

  if (action === 'recompute') {
    const q = await loadFullQuestionnaire(admin, vendorId)
    if (!q) return NextResponse.json({ error: 'Kein Fragebogen vorhanden' }, { status: 400 })
    const totals = computeOffer(q, (offer.answers as Answer[]) ?? [], offer.standard_info ?? {})
    const { error } = await admin.from('vendor_offers').update({
      line_items: totals.lineItems, subtotal: totals.subtotal,
      tax_mode: totals.taxMode, tax_rate: totals.taxRate, tax_amount: totals.taxAmount,
      total: totals.total, currency: totals.currency, valid_until: totals.validUntil,
      footer_note: totals.footerNote, updated_at: new Date().toISOString(),
    }).eq('id', offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // save + release teilen sich die Speicherung der editierten Positionen.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('lineItems' in body) {
    const items = sanitizeLineItems(body.lineItems)
    const totals = recomputeTotals(items, opts)
    patch.line_items = totals.lineItems
    patch.subtotal = totals.subtotal
    patch.tax_amount = totals.taxAmount
    patch.total = totals.total
  }
  if ('vendorNotes' in body) patch.vendor_notes = (body.vendorNotes as string) ?? ''
  if ('validUntil' in body) patch.valid_until = (body.validUntil as string) || null

  if (action === 'release') {
    const { data: request } = await admin
      .from('marketplace_requests')
      .select('id, event_id, dienstleister_id, requested_by, status, message')
      .eq('id', requestId)
      .maybeSingle()
    if (!request) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })

    patch.status = 'released'
    patch.released_at = new Date().toISOString()
    const { error } = await admin.from('vendor_offers').update(patch).eq('id', offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Annahme der Anfrage (idempotent) — oeffnet den Chat.
    let conversationId: string | null = null
    if (request.status === 'pending') {
      conversationId = await acceptMarketplaceRequest(admin, request, userId)
    }
    return NextResponse.json({ success: true, conversationId })
  }

  if (action === 'save') {
    const { error } = await admin.from('vendor_offers').update(patch).eq('id', offer.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
