import { createClient } from '@/lib/supabase/server'
import AblaufplanClient from './AblaufplanClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AblaufplanPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const [entriesRes, membersRes] = await Promise.all([
    supabase
      .from('timeline_entries')
      .select('id, event_id, title, location, sort_order, start_minutes, duration_minutes, category, checklist, responsibilities, created_at')
      .eq('event_id', eventId)
      .order('start_minutes', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('event_members')
      .select('id, user_id, role, profiles!user_id(id, name)')
      .eq('event_id', eventId),
  ])

  // Normalize Supabase joined arrays to single object
  const members = (membersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  return (
    <AblaufplanClient
      eventId={eventId}
      initialEntries={entriesRes.data ?? []}
      members={members}
    />
  )
}
