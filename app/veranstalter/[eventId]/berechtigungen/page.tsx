import { createClient } from '@/lib/supabase/server'
import BerechtigungenClient from './BerechtigungenClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function BerechtigungenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const [permRes, bpMembersRes, inviteRes] = await Promise.all([
    supabase
      .from('brautpaar_permissions')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_members')
      .select('id, user_id, profiles(id, name, email)')
      .eq('event_id', eventId)
      .eq('role', 'brautpaar'),
    supabase
      .from('invite_codes')
      .select('id, code, status, expires_at, created_at')
      .eq('event_id', eventId)
      .eq('role', 'brautpaar')
      .eq('status', 'offen')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const bpNormalized = (bpMembersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  return (
    <BerechtigungenClient
      eventId={eventId}
      initialPerms={permRes.data}
      bpMembers={bpNormalized}
      existingInvite={inviteRes.data}
    />
  )
}
