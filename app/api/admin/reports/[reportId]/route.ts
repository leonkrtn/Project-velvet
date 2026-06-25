import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { action, adminNote } = body

  if (action === 'close') {
    const update: Record<string, unknown> = { status: 'closed' }
    if (adminNote !== undefined) update.admin_note = adminNote || null

    const { error } = await admin.from('vendor_reports').update(update).eq('id', reportId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'note') {
    const { error } = await admin.from('vendor_reports').update({ admin_note: adminNote || null }).eq('id', reportId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'suspend_vendor') {
    // Get vendor_id from the report
    const { data: report } = await admin.from('vendor_reports').select('vendor_id').eq('id', reportId).maybeSingle()
    if (!report) return NextResponse.json({ error: 'Meldung nicht gefunden' }, { status: 404 })

    const { error: suspendError } = await admin
      .from('dienstleister_profiles')
      .update({ moderation_status: 'suspended', published: false })
      .eq('id', report.vendor_id)
    if (suspendError) return NextResponse.json({ error: suspendError.message }, { status: 500 })

    // Also close the report
    await admin.from('vendor_reports').update({ status: 'closed', admin_note: adminNote || 'Anbieter gesperrt' }).eq('id', reportId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
