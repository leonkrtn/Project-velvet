import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { computeVariantTotals } from '@/lib/vendor/variants'

async function loadOwnedVariant(
  admin: SupabaseClient,
  requestId: string,
  variantId: string,
  vendorId: string,
) {
  const { data: offer } = await admin.from('vendor_offers').select('*').eq('request_id', requestId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) return null
  const { data: variant } = await admin.from('vendor_offer_variants').select('*').eq('id', variantId).maybeSingle()
  if (!variant || variant.offer_id !== offer.id) return null
  return { offer, variant }
}

// PATCH — Variante bearbeiten. Body: { name?, lineItems? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string; variantId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId, variantId } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const ctx = await loadOwnedVariant(admin, requestId, variantId, vendorId)
  if (!ctx) return NextResponse.json({ error: 'Variante nicht gefunden' }, { status: 404 })
  if (ctx.offer.status === 'accepted') return NextResponse.json({ error: 'Angebot wurde bereits angenommen' }, { status: 409 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') patch.name = body.name.trim() || 'Variante'
  if ('lineItems' in body) {
    const t = computeVariantTotals(body.lineItems, ctx.offer)
    patch.line_items = t.lineItems
    patch.subtotal = t.subtotal
    patch.tax_amount = t.taxAmount
    patch.total = t.total
  }

  const { error } = await admin.from('vendor_offer_variants').update(patch).eq('id', variantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — Variante entfernen.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ requestId: string; variantId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId, variantId } = await params

  const ctx = await loadOwnedVariant(admin, requestId, variantId, vendorId)
  if (!ctx) return NextResponse.json({ error: 'Variante nicht gefunden' }, { status: 404 })
  if (ctx.offer.status === 'accepted') return NextResponse.json({ error: 'Angebot wurde bereits angenommen' }, { status: 409 })

  const { error } = await admin.from('vendor_offer_variants').delete().eq('id', variantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
