import { createClient } from '@/lib/supabase/server'
import AblaufplanClient from './AblaufplanClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AblaufplanPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const [entriesRes, membersRes, vendorsRes] = await Promise.all([
    supabase
      .from('timeline_entries')
      .select('id, event_id, title, location, sort_order, start_minutes, duration_minutes, category, checklist, responsibilities, assigned_staff, assigned_vendors, assigned_members, created_at')
      .eq('event_id', eventId)
      .order('start_minutes', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('event_members')
      .select('id, user_id, role, profiles!user_id(id, name)')
      .eq('event_id', eventId),
    supabase.from('vendors').select('id, name, category').eq('event_id', eventId).order('name'),
  ])

  // Normalize Supabase joined arrays to single object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membersRes.data ?? []).map((m: any) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  return (
    <AblaufplanClient
      eventId={eventId}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEntries={(entriesRes.data ?? []).map((e: any) => ({ ...e, assigned_staff: e.assigned_staff ?? [], assigned_vendors: e.assigned_vendors ?? [], assigned_members: e.assigned_members ?? [] }))}
      members={members}
      staff={[]}
      vendors={vendorsRes.data ?? []}
    />
  )
}
