import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { deleteR2Object } from '@/lib/files/worker-client'

const EDITABLE = [
  'name', 'company_name', 'category', 'email', 'phone', 'website',
  'description', 'street', 'zip', 'city', 'price_range', 'published', 'logo_r2_key',
] as const

// PATCH — Vendor-Profil aktualisieren (inkl. Veröffentlichen/Verstecken).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) patch[key] = body[key]
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Keine Felder' }, { status: 400 })
  }

  const { error } = await admin.from('dienstleister_profiles').update(patch).eq('id', id).eq('is_marketplace', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — Vendor-Profil + verknüpften Login-Account + R2-Bilder entfernen.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  // Bilder aus R2 löschen
  const { data: vendor } = await admin.from('dienstleister_profiles').select('logo_r2_key').eq('id', id).maybeSingle()
  const { data: photos } = await admin.from('marketplace_vendor_photos').select('r2_key').eq('dienstleister_id', id)
  const keys = [vendor?.logo_r2_key, ...(photos ?? []).map(p => p.r2_key)].filter(Boolean) as string[]
  await Promise.all(keys.map(k => deleteR2Object(k).catch(() => {})))

  // Verknüpfte Login-Accounts entfernen
  const { data: links } = await admin.from('user_dienstleister').select('user_id').eq('dienstleister_id', id)
  for (const l of links ?? []) {
    await admin.auth.admin.deleteUser((l as { user_id: string }).user_id).catch(() => {})
  }

  // Profil löschen (cascade entfernt photos, user_dienstleister, requests)
  const { error } = await admin.from('dienstleister_profiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
