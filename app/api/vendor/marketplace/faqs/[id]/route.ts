import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner, assertOwnsChild } from '@/lib/marketplace/owner'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { id } = await params
  if (!(await assertOwnsChild(admin, 'marketplace_faqs', id, vendorId))) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  if ('question' in body) patch.question = (body.question as string)?.trim() || 'Frage'
  if ('answer' in body) patch.answer = (body.answer as string)?.trim() || ''
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Keine Felder' }, { status: 400 })

  const { error } = await admin.from('marketplace_faqs').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { id } = await params
  if (!(await assertOwnsChild(admin, 'marketplace_faqs', id, vendorId))) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
  await admin.from('marketplace_faqs').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
