import { NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { loadVendorStats } from '@/lib/marketplace/stats'

// GET — Marktplatz-Statistik des eingeloggten Anbieters (eigene Zahlen).
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  try {
    const stats = await loadVendorStats(admin, vendorId)
    return NextResponse.json(stats)
  } catch {
    // Falls die Tracking-Migration noch nicht angewandt ist: leere Statistik.
    return NextResponse.json({
      total: { profile_view: 0, contact_email: 0, contact_phone: 0, website: 0, social: 0, request: 0 },
      last30: { profile_view: 0, contact_email: 0, contact_phone: 0, website: 0, social: 0, request: 0 },
      series: [],
    })
  }
}
