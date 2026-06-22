import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { num } from '@/lib/vendor/offer-service'
import type { LineItemType } from '@/lib/vendor/pricing'

const TYPES: LineItemType[] = ['qty', 'flat', 'discount', 'optional']

// GET — eigene Bausteinbibliothek.
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { data } = await admin
    .from('vendor_offer_blocks')
    .select('*')
    .eq('dienstleister_id', vendorId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return NextResponse.json({ blocks: data ?? [] })
}

// POST — neuen Baustein speichern. body: { label, itemType, defaultQty, unitPrice }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const label = (body.label as string)?.trim()
  if (!label) return NextResponse.json({ error: 'Bezeichnung fehlt' }, { status: 400 })
  const itemType = (TYPES.includes(body.itemType as LineItemType) ? body.itemType : 'qty') as LineItemType

  const { data, error } = await admin.from('vendor_offer_blocks').insert({
    dienstleister_id: vendorId, label, item_type: itemType,
    default_qty: num(body.defaultQty) || 1, unit_price: num(body.unitPrice),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
