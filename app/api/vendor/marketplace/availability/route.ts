import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { data } = await admin
    .from('marketplace_availability')
    .select('id, day, status')
    .eq('dienstleister_id', vendorId)
    .order('day')
  return NextResponse.json({ availability: data ?? [] })
}

// POST — Tag als belegt/blockiert markieren. Body: { day: 'YYYY-MM-DD', status? }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const body = await req.json().catch(() => ({})) as { day?: string; status?: string }
  const day = body.day?.trim()
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 })
  }
  const status = body.status === 'booked' ? 'booked' : 'blocked'

  const { data, error } = await admin
    .from('marketplace_availability')
    .upsert({ dienstleister_id: vendorId, day, status }, { onConflict: 'dienstleister_id,day' })
    .select('id, day, status')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, day: data })
}

// DELETE — Tag wieder freigeben. Query: ?day=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const day = req.nextUrl.searchParams.get('day')
  if (!day) return NextResponse.json({ error: 'day fehlt' }, { status: 400 })
  await admin.from('marketplace_availability').delete().eq('dienstleister_id', vendorId).eq('day', day)
  return NextResponse.json({ success: true })
}
