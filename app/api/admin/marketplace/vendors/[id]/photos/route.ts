import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'

// GET — Galerie-Fotos eines Vendors (mit presigned URLs).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  const { data, error } = await admin
    .from('marketplace_vendor_photos')
    .select('id, dienstleister_id, r2_key, sort_order')
    .eq('dienstleister_id', id)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const photos = await Promise.all((data ?? []).map(async p => ({
    ...p,
    url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))
  return NextResponse.json({ photos })
}

// POST — Galerie-Foto nach erfolgtem R2-Upload registrieren. Body: { r2_key }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  const { r2_key } = await req.json().catch(() => ({})) as { r2_key?: string }
  if (!r2_key) return NextResponse.json({ error: 'r2_key fehlt' }, { status: 400 })

  const { count } = await admin
    .from('marketplace_vendor_photos')
    .select('id', { count: 'exact', head: true })
    .eq('dienstleister_id', id)

  const { data, error } = await admin
    .from('marketplace_vendor_photos')
    .insert({ dienstleister_id: id, r2_key, sort_order: count ?? 0 })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
