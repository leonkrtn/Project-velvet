import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MitarbeiterHub from './MitarbeiterHub'
import type { AbrechnungLog } from './AbrechnungModal'

export type ShiftDay = { date: string; eventId: string; eventTitle: string }

export default async function MitarbeiterLandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: staffRow } = await admin
    .from('organizer_staff')
    .select('id, name, must_change_password, organizer_id, hourly_rate')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!staffRow) redirect('/login')
  if (staffRow.must_change_password) redirect('/mitarbeiter/change-password')

  // Fetch assignments with day dates + event info
  const { data: assignments } = await admin
    .from('personalplanung_assignments')
    .select('personalplanung_days!inner(date, event_id, events!inner(id, title, date))')
    .eq('staff_id', staffRow.id)

  type AssignmentRow = {
    personalplanung_days: {
      date: string | null
      event_id: string
      events: { id: string; title: string; date: string | null }
    }
  }

  // Build shift days (for calendar) and event list
  const seenShiftDays = new Set<string>()
  const shiftDays: ShiftDay[] = []
  const eventCountMap = new Map<string, { id: string; title: string; date: string | null; count: number }>()

  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    const day = a.personalplanung_days
    if (!day.date) continue

    const key = `${day.date}-${day.events.id}`
    if (!seenShiftDays.has(key)) {
      seenShiftDays.add(key)
      shiftDays.push({ date: day.date, eventId: day.events.id, eventTitle: day.events.title })
    }

    const ev = eventCountMap.get(day.events.id)
    if (ev) {
      ev.count++
    } else {
      eventCountMap.set(day.events.id, { id: day.events.id, title: day.events.title, date: day.events.date, count: 1 })
    }
  }

  const events = Array.from(eventCountMap.values())
    .map(ev => ({ id: ev.id, title: ev.title, date: ev.date, shiftCount: ev.count }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  // Fetch abrechnung data: time logs with shift hourly_rate + event info
  const { data: rawLogs } = await admin
    .from('shift_time_logs')
    .select(`
      actual_start, actual_end,
      personalplanung_shifts!inner(
        hourly_rate,
        personalplanung_days!inner(
          date,
          event_id,
          events!inner(id, title)
        )
      )
    `)
    .eq('staff_id', staffRow.id)
    .not('actual_start', 'is', null)
    .not('actual_end', 'is', null)

  type RawLog = {
    actual_start: string
    actual_end: string
    personalplanung_shifts: {
      hourly_rate: number | null
      personalplanung_days: {
        date: string
        event_id: string
        events: { id: string; title: string }
      }
    }
  }

  const abrechnungLogs: AbrechnungLog[] = ((rawLogs ?? []) as unknown as RawLog[]).map(log => ({
    actualStart: log.actual_start,
    actualEnd: log.actual_end,
    shiftHourlyRate: log.personalplanung_shifts.hourly_rate,
    dayDate: log.personalplanung_shifts.personalplanung_days.date,
    eventId: log.personalplanung_shifts.personalplanung_days.events.id,
    eventTitle: log.personalplanung_shifts.personalplanung_days.events.title,
  }))

  return (
    <MitarbeiterHub
      staffName={staffRow.name}
      staffHourlyRate={staffRow.hourly_rate ?? null}
      events={events}
      shiftDays={shiftDays}
      abrechnungLogs={abrechnungLogs}
    />
  )
}
