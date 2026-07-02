import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

// GET/PATCH — Opt-in-Benachrichtigungen, die nicht ins Automatisierungs-Schema
// (zeitversetzte Regeln) passen, aktuell: neue Anfrage per E-Mail mit Excel-Anhang.
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { data } = await admin
    .from('dienstleister_profiles')
    .select('notify_new_request_email')
    .eq('id', vendorId)
    .maybeSingle()

  return NextResponse.json({ notifyNewRequestEmail: !!data?.notify_new_request_email })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const body = await req.json().catch(() => ({})) as { notifyNewRequestEmail?: unknown }
  const value = body.notifyNewRequestEmail === true

  const { error } = await admin
    .from('dienstleister_profiles')
    .update({ notify_new_request_email: value })
    .eq('id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, notifyNewRequestEmail: value })
}
