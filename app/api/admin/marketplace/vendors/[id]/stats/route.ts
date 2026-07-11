import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { loadVendorStats } from '@/lib/marketplace/stats'

// GET — Tracking-Statistik eines einzelnen Anbieters (für die Detailansicht).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    const stats = await loadVendorStats(auth.admin, id)
    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({
      total: { profile_view: 0, contact_email: 0, contact_phone: 0, website: 0, social: 0, request: 0 },
      last30: { profile_view: 0, contact_email: 0, contact_phone: 0, website: 0, social: 0, request: 0 },
      series: [],
    })
  }
}
