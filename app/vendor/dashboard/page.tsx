import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendorEventsClient from './VendorEventsClient'

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

  type EventRow = { id: string; title: string; date: string | null; venue: string | null; event_code: string | null }
  const events = (memberships ?? [])
    .map(m => (Array.isArray(m.events) ? m.events[0] : m.events) as EventRow | null)
    .filter((e): e is EventRow => !!e)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>Velvet.</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Meine Events</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Alle Events, bei denen du als Dienstleister eingetragen bist.</p>
        </div>

        <VendorEventsClient events={events} />
      </div>
    </div>
  )
}
