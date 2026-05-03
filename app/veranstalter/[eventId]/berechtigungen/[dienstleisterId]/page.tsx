import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BerechtigungenDLClient from './BerechtigungenClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ eventId: string; dienstleisterId: string }>
}

export interface DienstleisterPermRow {
  id: string
  tab_key: string
  item_id: string | null
  access: 'none' | 'read' | 'write'
}

export default async function DienstleisterBerechtigungenPage({ params }: Props) {
  const { eventId, dienstleisterId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  const { data: dlProfile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', dienstleisterId)
    .maybeSingle()

  if (!dlProfile) redirect(`/veranstalter/${eventId}/mitglieder`)

  const { data: dlMember } = await supabase
    .from('event_members')
    .select('id, role')
    .eq('event_id', eventId)
    .eq('user_id', dienstleisterId)
    .single()

  if (!dlMember || dlMember.role !== 'dienstleister') redirect(`/veranstalter/${eventId}/mitglieder`)

  const { data: perms } = await supabase
    .from('dienstleister_permissions')
    .select('id, tab_key, item_id, access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', dienstleisterId)

  return (
    <BerechtigungenDLClient
      eventId={eventId}
      dienstleisterId={dienstleisterId}
      dienstleisterName={dlProfile.name ?? 'Dienstleister'}
      dienstleisterEmail={dlProfile.email ?? ''}
      initialPerms={(perms ?? []) as DienstleisterPermRow[]}
    />
  )
}
