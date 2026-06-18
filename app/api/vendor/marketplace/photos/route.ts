import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { requestDownloadUrl } from '@/lib/files/worker-client'

// GET — eigene Galerie-Fotos (mit presigned URLs).
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { data } = await admin
    .from('marketplace_vendor_photos')
    .select('id, r2_key, sort_order')
    .eq('dienstleister_id', vendorId)
    .order('sort_order')

  const photos = await Promise.all((data ?? []).map(async p => ({
    id: p.id, sort_order: p.sort_order, url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))
  return NextResponse.json({ photos })
}

// POST — Foto nach R2-Upload registrieren. Body: { r2_key }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { r2_key } = await req.json().catch(() => ({})) as { r2_key?: string }
  if (!r2_key || !r2_key.startsWith(`marketplace/${vendorId}/`)) {
    return NextResponse.json({ error: 'Ungültiger Schlüssel' }, { status: 400 })
  }

  const { count } = await admin
    .from('marketplace_vendor_photos')
    .select('id', { count: 'exact', head: true })
    .eq('dienstleister_id', vendorId)
  if ((count ?? 0) >= 15) {
    return NextResponse.json({ error: 'Maximal 15 Fotos' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('marketplace_vendor_photos')
    .insert({ dienstleister_id: vendorId, r2_key, sort_order: count ?? 0 })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}

// PATCH — Reihenfolge setzen. Body: { order: string[] (photoIds) }
export async function PATCH(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { order } = await req.json().catch(() => ({})) as { order?: string[] }
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order fehlt' }, { status: 400 })

  await Promise.all(order.map((id, i) =>
    admin.from('marketplace_vendor_photos').update({ sort_order: i }).eq('id', id).eq('dienstleister_id', vendorId),
  ))
  return NextResponse.json({ success: true })
}
