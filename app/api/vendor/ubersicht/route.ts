import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link) return NextResponse.json({ stats: { pendingAnfragen: 0, eventCount: 0, releasedOffers: 0, acceptedOffers: 0 }, recentAnfragen: [] })

  const [anfragenRes, eventsRes, offersRes, recentAnfragenRes] = await Promise.all([
    admin
      .from('marketplace_requests')
      .select('*', { count: 'exact', head: true })
      .eq('dienstleister_id', link.dienstleister_id)
      .eq('status', 'pending'),
    admin
      .from('event_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'dienstleister'),
    admin
      .from('vendor_offers')
      .select('status', { count: 'exact' })
      .eq('dienstleister_id', link.dienstleister_id)
      .in('status', ['released', 'accepted']),
    admin
      .from('marketplace_requests')
      .select('id, status, created_at, events(title, date, couple_name)')
      .eq('dienstleister_id', link.dienstleister_id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const allOffers = offersRes.data ?? []
  const releasedOffers = allOffers.filter(o => o.status === 'released').length
  const acceptedOffers = allOffers.filter(o => o.status === 'accepted').length

  return NextResponse.json({
    stats: {
      pendingAnfragen: anfragenRes.count ?? 0,
      eventCount: eventsRes.count ?? 0,
      releasedOffers,
      acceptedOffers,
    },
    recentAnfragen: recentAnfragenRes.data ?? [],
  })
}
