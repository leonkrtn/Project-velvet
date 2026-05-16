import { createClient } from '@/lib/supabase/server'
import AblaufplanClient from './AblaufplanClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AblaufplanPage({ params }: Props) {
  const { eventId } = await params
  const supabase    = await createClient()

  const [entriesRes, membersRes, vendorsRes, daysRes] = await Promise.all([
    supabase
      .from('timeline_entries')
      .select('*')
      .eq('event_id', eventId)
      .order('day_index',     { ascending: true })
      .order('start_minutes', { ascending: true, nullsFirst: false })
      .order('sort_order',    { ascending: true }),
    supabase
      .from('event_members')
      .select('id, user_id, role, profiles!user_id(id, name)')
      .eq('event_id', eventId),
    supabase
      .from('vendors')
      .select('id, name, category')
      .eq('event_id', eventId)
      .order('name'),
    supabase
      .from('ablaufplan_days')
      .select('*')
      .eq('event_id', eventId)
      .order('day_index', { ascending: true }),
  ])

  if (entriesRes.error) console.error('[Ablaufplan] entries:', entriesRes.error.message)
  if (membersRes.error) console.error('[Ablaufplan] members:', membersRes.error.message)
  if (vendorsRes.error) console.error('[Ablaufplan] vendors:', vendorsRes.error.message)
  if (daysRes.error)    console.error('[Ablaufplan] days:',    daysRes.error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membersRes.data ?? []).map((m: any) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  return (
    <AblaufplanClient
      eventId={eventId}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEntries={(entriesRes.data ?? []).map((e: any) => ({
        ...e,
        assigned_staff:   e.assigned_staff   ?? [],
        assigned_vendors: e.assigned_vendors ?? [],
        assigned_members: e.assigned_members ?? [],
        checklist:        e.checklist        ?? [],
      }))}
      initialDays={daysRes.data ?? []}
      members={members}
      staff={[]}
      vendors={vendorsRes.data ?? []}
      role="veranstalter"
    />
  )
}
