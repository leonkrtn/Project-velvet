import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner, assertOwnsChild } from '@/lib/marketplace/owner'
import { PRICE_UNITS } from '@/lib/marketplace/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { id } = await params
  if (!(await assertOwnsChild(admin, 'marketplace_packages', id, vendorId))) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  if ('title' in body) patch.title = (body.title as string)?.trim() || 'Paket'
  if ('description' in body) patch.description = (body.description as string)?.trim() || ''
  if ('price_from' in body) {
    const n = body.price_from != null && body.price_from !== '' ? Number(body.price_from) : null
    patch.price_from = Number.isFinite(n as number) ? n : null
  }
  if ('price_unit' in body && (PRICE_UNITS as readonly { key: string }[]).some(u => u.key === body.price_unit)) patch.price_unit = body.price_unit
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Keine Felder' }, { status: 400 })

  const { error } = await admin.from('marketplace_packages').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { id } = await params
  if (!(await assertOwnsChild(admin, 'marketplace_packages', id, vendorId))) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
  await admin.from('marketplace_packages').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
