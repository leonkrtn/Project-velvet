import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyVendorReport } from '@/lib/admin/notify'

const VALID_REASONS = ['falsche_angaben', 'unangemessene_bilder', 'betrug', 'spam'] as const

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json()
  const { vendorId, reason, comment } = body

  if (!vendorId || !reason) return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  if (!VALID_REASONS.includes(reason)) return NextResponse.json({ error: 'Ungültiger Grund' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vendor_reports').insert({
    vendor_id: vendorId,
    reason,
    comment: comment?.trim() || null,
    reporter_user_id: user.id,
    status: 'open',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Admins benachrichtigen (best effort).
  const { data: vendor } = await admin
    .from('dienstleister_profiles')
    .select('name, company_name')
    .eq('id', vendorId)
    .maybeSingle()
  await notifyVendorReport(admin, { name: vendor?.name ?? null, company_name: vendor?.company_name ?? null }, reason, comment?.trim() || null)

  return NextResponse.json({ ok: true })
}
