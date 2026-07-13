export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PersonalplanungClient, { type PersonalplanungInitialData } from './PersonalplanungClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function PersonalplanungPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: staffRows }, { data: dayRows }, { data: eventRow }, { data: tlRows }] = await Promise.all([
    supabase.from('organizer_staff').select('id,name,role_category,available_days,phone,hourly_rate,auth_user_id').eq('organizer_id', user.id).order('name'),
    supabase.from('personalplanung_days').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('events').select('title,date').eq('id', eventId).single(),
    supabase.from('timeline_entries').select('*').eq('event_id', eventId).order('start_minutes'),
  ])

  const dayList = (dayRows ?? []) as { id: string }[]

  let assignments: unknown[] = []
  let shifts: unknown[] = []
  let swaps: unknown[] = []
  let timeLogs: unknown[] = []

  if (dayList.length > 0) {
    const dayIds = dayList.map(d => d.id)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    const [{ data: aRows }, { data: sRows }, { data: swapRows }, { data: logRows }] = await Promise.all([
      supabase.from('personalplanung_assignments').select('*').in('day_id', dayIds),
      supabase.from('personalplanung_shifts').select('*').in('day_id', dayIds).order('start_hour'),
      supabase.from('personalplanung_shift_swaps').select('*').eq('event_id', eventId).in('status', ['pending', 'accepted']),
      supabase.from('shift_time_logs').select('staff_id,actual_start,actual_end').eq('event_id', eventId).not('actual_end', 'is', null).gte('actual_start', monthStart).lt('actual_start', monthEnd),
    ])
    assignments = aRows ?? []
    shifts = sRows ?? []
    swaps = swapRows ?? []
    timeLogs = logRows ?? []
  }

  const eventTyped = eventRow as { title: string; date: string | null } | null

  const initial = {
    staff: staffRows ?? [],
    days: dayRows ?? [],
    assignments,
    shifts,
    eventInfo: eventTyped ? { title: eventTyped.title, date: eventTyped.date } : null,
    timelineEntries: tlRows ?? [],
    swaps,
    timeLogs,
  } as unknown as PersonalplanungInitialData

  return <PersonalplanungClient eventId={eventId} initial={initial} />
}
