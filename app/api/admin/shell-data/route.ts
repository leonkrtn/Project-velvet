import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const [{ count: pendingVendors }, { count: openReports }] = await Promise.all([
    admin
      .from('dienstleister_profiles')
      .select('id', { count: 'exact', head: true })
      .or('moderation_status.eq.pending,pending_changes.neq.null'),
    admin
      .from('vendor_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ])

  return NextResponse.json({
    anbieter: pendingVendors ?? 0,
    meldungen: openReports ?? 0,
  })
}
