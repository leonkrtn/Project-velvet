import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { listVariants, computeVariantTotals } from '@/lib/vendor/variants'

// GET — Varianten zum eigenen Angebot.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId } = await params

  const { data: offer } = await admin.from('vendor_offers').select('id, dienstleister_id').eq('request_id', requestId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })

  const variants = await listVariants(admin, offer.id)
  return NextResponse.json({ variants })
}

// POST — neue Variante. Body: { name?, fromCurrent?: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { requestId } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const { data: offer } = await admin.from('vendor_offers').select('*').eq('request_id', requestId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  if (offer.status === 'accepted') return NextResponse.json({ error: 'Angebot wurde bereits angenommen' }, { status: 409 })

  const existing = await listVariants(admin, offer.id)
  const seed = body.fromCurrent ? offer.line_items : []
  const t = computeVariantTotals(seed, offer)

  const { data, error } = await admin.from('vendor_offer_variants').insert({
    offer_id: offer.id,
    name: (body.name as string)?.trim() || `Variante ${existing.length + 1}`,
    line_items: t.lineItems,
    subtotal: t.subtotal,
    tax_amount: t.taxAmount,
    total: t.total,
    sort_order: existing.length,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variant: data })
}
