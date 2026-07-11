import { NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { notifyVendorSubmit } from '@/lib/admin/notify'

// POST — Profil zur Erstprüfung einreichen (draft|rejected → pending).
export async function POST() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { data: v } = await admin
    .from('dienstleister_profiles')
    .select('moderation_status, company_name, name, category, description, city, logo_r2_key, phone, email')
    .eq('id', vendorId)
    .single()
  if (!v) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  if (!['draft', 'rejected'].includes(v.moderation_status)) {
    return NextResponse.json({ error: 'Profil ist bereits eingereicht oder freigegeben' }, { status: 409 })
  }

  // Pflichtangaben vor dem Einreichen.
  const { count: photoCount } = await admin
    .from('marketplace_vendor_photos')
    .select('id', { count: 'exact', head: true })
    .eq('dienstleister_id', vendorId)

  const missing: string[] = []
  if (!v.company_name?.trim()) missing.push('Firmenname')
  if (!v.description?.trim() || v.description.trim().length < 30) missing.push('Beschreibung (mind. 30 Zeichen)')
  if (!v.city?.trim()) missing.push('Stadt')
  if ((photoCount ?? 0) < 1) missing.push('mindestens 1 Foto')
  if (!v.logo_r2_key) missing.push('Logo')
  if (!v.phone?.trim() && !v.email?.trim()) missing.push('Kontakt (Telefon oder E-Mail)')

  if (missing.length > 0) {
    return NextResponse.json({ error: `Bitte zuerst ausfüllen: ${missing.join(', ')}`, missing }, { status: 400 })
  }

  const { error } = await admin
    .from('dienstleister_profiles')
    .update({ moderation_status: 'pending', submitted_at: new Date().toISOString(), rejected_reason: null })
    .eq('id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Admins benachrichtigen (best effort). Erst-Einreichung, kein Änderungs-Review.
  await notifyVendorSubmit(admin, { name: v.name, company_name: v.company_name, category: v.category }, false)

  return NextResponse.json({ success: true })
}
