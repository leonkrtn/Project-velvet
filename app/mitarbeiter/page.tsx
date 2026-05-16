import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MitarbeiterKalender from './MitarbeiterKalender'

export type ShiftDay = { date: string; eventId: string; eventTitle: string }

export default async function MitarbeiterLandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: staffRow } = await admin
    .from('organizer_staff')
    .select('id, name, must_change_password, organizer_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!staffRow) redirect('/login')
  if (staffRow.must_change_password) redirect('/mitarbeiter/change-password')

  const { data: assignments } = await admin
    .from('personalplanung_assignments')
    .select('personalplanung_days!inner(date, event_id, events!inner(id, title))')
    .eq('staff_id', staffRow.id)

  type AssignmentRow = {
    personalplanung_days: {
      date: string | null
      event_id: string
      events: { id: string; title: string }
    }
  }

  const seen = new Set<string>()
  const shiftDays: ShiftDay[] = []
  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    const day = a.personalplanung_days
    if (!day.date) continue
    const key = `${day.date}-${day.events.id}`
    if (seen.has(key)) continue
    seen.add(key)
    shiftDays.push({ date: day.date, eventId: day.events.id, eventTitle: day.events.title })
  }

  return <MitarbeiterKalender shiftDays={shiftDays} staffName={staffRow.name} />
}
