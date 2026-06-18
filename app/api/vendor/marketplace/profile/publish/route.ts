import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

// POST — Listing selbst online/offline schalten. Nur nach Erstfreigabe möglich.
// Body: { published: boolean }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { published } = await req.json().catch(() => ({})) as { published?: boolean }

  const { data: v } = await admin
    .from('dienstleister_profiles')
    .select('moderation_status')
    .eq('id', vendorId)
    .single()
  if (!v) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  if (v.moderation_status !== 'approved') {
    return NextResponse.json({ error: 'Erst nach der Freigabe verfügbar' }, { status: 409 })
  }

  const { error } = await admin
    .from('dienstleister_profiles')
    .update({ published: !!published })
    .eq('id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, published: !!published })
}
