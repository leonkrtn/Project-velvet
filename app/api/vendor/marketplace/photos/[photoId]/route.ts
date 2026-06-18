import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { deleteR2Object } from '@/lib/files/worker-client'

// DELETE — eigenes Galerie-Foto entfernen (DB + R2).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { photoId } = await params

  const { data: photo } = await admin
    .from('marketplace_vendor_photos')
    .select('id, r2_key, dienstleister_id')
    .eq('id', photoId)
    .maybeSingle()
  if (!photo || photo.dienstleister_id !== vendorId) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  await admin.from('marketplace_vendor_photos').delete().eq('id', photoId)
  await deleteR2Object(photo.r2_key).catch(() => {})
  return NextResponse.json({ success: true })
}
