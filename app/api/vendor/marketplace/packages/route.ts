import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { PRICE_UNITS } from '@/lib/marketplace/types'

export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { data } = await admin.from('marketplace_packages').select('*').eq('dienstleister_id', vendorId).order('sort_order')
  return NextResponse.json({ packages: data ?? [] })
}

// POST — neues Paket. Body: { title, description?, price_from?, price_unit? }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const title = (body.title as string)?.trim()
  if (!title) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })

  const unit = (PRICE_UNITS as readonly { key: string }[]).some(u => u.key === body.price_unit) ? body.price_unit as string : 'ab'
  const priceFrom = body.price_from != null && body.price_from !== '' ? Number(body.price_from) : null

  const { count } = await admin.from('marketplace_packages').select('id', { count: 'exact', head: true }).eq('dienstleister_id', vendorId)
  const { data, error } = await admin.from('marketplace_packages').insert({
    dienstleister_id: vendorId,
    title,
    description: (body.description as string)?.trim() || '',
    price_from: Number.isFinite(priceFrom as number) ? priceFrom : null,
    price_unit: unit,
    sort_order: count ?? 0,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
