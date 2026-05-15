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
    .select('id, name, must_change_password, organizer_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!staffRow) redirect('/login')
  if (staffRow.must_change_password) redirect('/mitarbeiter/change-password')

  const [{ data: eventData }, { data: dayRows }] = await Promise.all([
    admin.from('events').select('title, date').eq('id', eventId).single(),
    admin.from('personalplanung_days').select('*').eq('event_id', eventId).order('sort_order'),
  ])

  const days = dayRows ?? []
  const dayIds = days.map((d: { id: string }) => d.id)

  // Only load days this staff member is assigned to
  let myDayIds: string[] = []
  if (dayIds.length > 0) {
    const { data: assignments } = await admin
      .from('personalplanung_assignments')
      .select('day_id')
      .eq('staff_id', staffRow.id)
      .in('day_id', dayIds)
    myDayIds = (assignments ?? []).map((a: { day_id: string }) => a.day_id)
  }

  const myDays = days.filter((d: { id: string }) => myDayIds.includes(d.id))

  type ShiftRow = { id: string; day_id: string; staff_id: string; task: string; start_hour: number; end_hour: number; backup_staff_id: string | null }
  let myShifts: ShiftRow[] = []
  let allStaff: { id: string; name: string }[] = []

  if (myDayIds.length > 0) {
    const [{ data: shiftsData }, { data: staffData }] = await Promise.all([
      admin.from('personalplanung_shifts').select('*').eq('staff_id', staffRow.id).in('day_id', myDayIds).order('start_hour'),
      admin.from('organizer_staff').select('id, name').eq('organizer_id', staffRow.organizer_id),
    ])
    myShifts = (shiftsData ?? []) as ShiftRow[]
    allStaff = (staffData ?? []) as { id: string; name: string }[]
  }

  // Pending swap requests I made
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
      days={myDays}
      shifts={myShifts}
      allStaff={allStaff}
      mySwaps={(mySwaps ?? []) as { id: string; shift_id: string; to_staff_id: string | null; status: string; notes: string | null; requested_at: string }[]}
    />
  )
}
