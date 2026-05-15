import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import SchichtplanClient from './SchichtplanClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function MitarbeiterSchichtplanPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: staffRow } = await admin
    .from('organizer_staff')
    .select('id, name, must_change_password, organizer_id, auth_user_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!staffRow) redirect('/login')
  if (staffRow.must_change_password) redirect('/mitarbeiter/change-password')

  const [{ data: eventData }, { data: dayRows }] = await Promise.all([
    admin.from('events').select('title, date').eq('id', eventId).single(),
    admin.from('personalplanung_days').select('*').eq('event_id', eventId).order('sort_order'),
  ])

  const days = (dayRows ?? []) as { id: string; label: string; date: string; sort_order: number }[]
  const dayIds = days.map(d => d.id)

  type ShiftRow = { id: string; day_id: string; staff_id: string; task: string; start_hour: number; end_hour: number; backup_staff_id: string | null }
  type TimeLogRow = { id: string; shift_id: string; staff_id: string; actual_start: string | null; actual_end: string | null; notes: string | null }

  let myDayIds: string[] = []
  let allShifts: ShiftRow[] = []
  let allStaff: { id: string; name: string }[] = []
  let myTimeLogs: TimeLogRow[] = []

  if (dayIds.length > 0) {
    const [{ data: assignments }, { data: shiftsData }, { data: staffData }, { data: logsData }] = await Promise.all([
      admin.from('personalplanung_assignments').select('day_id').eq('staff_id', staffRow.id).in('day_id', dayIds),
      admin.from('personalplanung_shifts').select('*').in('day_id', dayIds).order('start_hour'),
      admin.from('organizer_staff').select('id, name').eq('organizer_id', staffRow.organizer_id),
      admin.from('shift_time_logs').select('id, shift_id, staff_id, actual_start, actual_end, notes').eq('staff_id', staffRow.id).eq('event_id', eventId),
    ])
    myDayIds = (assignments ?? []).map(a => a.day_id)
    allShifts = (shiftsData ?? []) as ShiftRow[]
    allStaff = (staffData ?? []) as { id: string; name: string }[]
    myTimeLogs = (logsData ?? []) as TimeLogRow[]
  }

  const myDays = days.filter(d => myDayIds.includes(d.id))
  const myShifts = allShifts.filter(s => s.staff_id === staffRow.id && myDayIds.includes(s.day_id))

  const { data: mySwaps } = await admin
    .from('personalplanung_shift_swaps')
    .select('id, shift_id, to_staff_id, status, notes, requested_at')
    .eq('from_staff_id', staffRow.id)
    .in('status', ['pending', 'accepted'])

  return (
    <SchichtplanClient
      eventId={eventId}
      eventTitle={eventData?.title ?? ''}
      staffId={staffRow.id}
      staffName={staffRow.name}
      staffAuthUserId={staffRow.auth_user_id ?? ''}
      organizerAuthUserId={staffRow.organizer_id}
      days={myDays}
      allDays={days}
      myShifts={myShifts}
      allShifts={allShifts}
      allStaff={allStaff}
      mySwaps={(mySwaps ?? []) as { id: string; shift_id: string; to_staff_id: string | null; status: string; notes: string | null; requested_at: string }[]}
      myTimeLogs={myTimeLogs}
    />
  )
}
