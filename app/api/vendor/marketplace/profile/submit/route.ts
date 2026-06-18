import { NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

// POST — Profil zur Erstprüfung einreichen (draft|rejected → pending).
export async function POST() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { data: v } = await admin
    .from('dienstleister_profiles')
    .select('moderation_status, name, category')
    .eq('id', vendorId)
    .single()
  if (!v) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  if (!['draft', 'rejected'].includes(v.moderation_status)) {
    return NextResponse.json({ error: 'Profil ist bereits eingereicht oder freigegeben' }, { status: 409 })
  }
  if (!v.name?.trim()) {
    return NextResponse.json({ error: 'Bitte zuerst einen Namen hinterlegen' }, { status: 400 })
  }

  const { error } = await admin
    .from('dienstleister_profiles')
    .update({ moderation_status: 'pending', submitted_at: new Date().toISOString(), rejected_reason: null })
    .eq('id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
