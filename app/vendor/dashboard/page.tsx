import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VendorEventsClient from './VendorEventsClient'

export const dynamic = 'force-dynamic'

export default async function VendorOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/dashboard')

  const { data: memberships } = await supabase
    .from('event_members')
    .select('event_id, events(id, title, date, venue, event_code)')
    .eq('user_id', user.id)
    .eq('role', 'dienstleister')
    .order('joined_at', { ascending: false })

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let acceptedEventIds: string[] = []
  if (link) {
    const { data: acceptedOffers } = await admin
      .from('vendor_offers')
      .select('event_id')
      .eq('dienstleister_id', link.dienstleister_id)
      .eq('status', 'accepted')
    acceptedEventIds = (acceptedOffers ?? []).map((o: { event_id: string }) => o.event_id)
  }

  type EventRow = { id: string; title: string; date: string | null; venue: string | null; event_code: string | null }
  const events = (memberships ?? [])
    .map(m => (Array.isArray(m.events) ? m.events[0] : m.events) as EventRow | null)
    .filter((e): e is EventRow => !!e)

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Meine Events</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Alle Events, bei denen du als Dienstleister eingetragen bist.</p>
        </div>
        <VendorEventsClient events={events} acceptedEventIds={acceptedEventIds} />
      </div>
    </div>
  )
}
