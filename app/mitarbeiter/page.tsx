import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function MitarbeiterLandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Find this user's organizer_staff record
  const { data: staffRow } = await admin
    .from('organizer_staff')
    .select('id, name, must_change_password, organizer_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!staffRow) redirect('/login')
  if (staffRow.must_change_password) redirect('/mitarbeiter/change-password')

  // Find events this staff member is assigned to
  const { data: assignments } = await admin
    .from('personalplanung_assignments')
    .select('day_id, personalplanung_days!inner(event_id, events!inner(id, title, date))')
    .eq('staff_id', staffRow.id)

  type EventRow = { id: string; title: string; date: string | null }
  const eventMap = new Map<string, EventRow>()
  for (const a of assignments ?? []) {
    const day = (a as unknown as { personalplanung_days: { events: EventRow } }).personalplanung_days
    const ev = day?.events
    if (ev && !eventMap.has(ev.id)) eventMap.set(ev.id, ev)
  }
  const events = Array.from(eventMap.values())

  // If only one event, redirect directly to the shift plan
  if (events.length === 1) redirect(`/mitarbeiter/${events[0].id}/schichtplan`)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>
          Mein Schichtplan
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
          Willkommen, {staffRow.name}. Wähle ein Event.
        </p>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', border: '2px dashed #E5E7EB', borderRadius: 12 }}>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Du bist noch keinem Event zugeteilt.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map(ev => (
            <a key={ev.id} href={`/mitarbeiter/${ev.id}/schichtplan`} style={{
              display: 'block', padding: '16px 18px',
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
              textDecoration: 'none', color: 'inherit',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>{ev.title}</p>
              {ev.date && (
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                  {new Date(ev.date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
