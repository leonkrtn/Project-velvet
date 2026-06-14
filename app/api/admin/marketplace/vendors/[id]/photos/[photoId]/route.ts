import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { deleteR2Object } from '@/lib/files/worker-client'

// DELETE — Galerie-Foto entfernen (DB-Zeile + R2-Objekt).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id, photoId } = await params

  const { data: photo } = await admin
    .from('marketplace_vendor_photos')
    .select('r2_key')
    .eq('id', photoId)
    .eq('dienstleister_id', id)
    .maybeSingle()
  if (!photo) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await admin.from('marketplace_vendor_photos').delete().eq('id', photoId)
  await deleteR2Object(photo.r2_key).catch(() => {})
  return NextResponse.json({ success: true })
}
