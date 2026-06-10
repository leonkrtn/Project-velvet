export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BerechtigungenDLClient from '@/app/veranstalter/[eventId]/berechtigungen/[dienstleisterId]/BerechtigungenClient'
import type { DienstleisterPermRow } from '@/app/veranstalter/[eventId]/berechtigungen/[dienstleisterId]/page'

interface Props {
  params: Promise<{ eventId: string; dienstleisterId: string }>
}

// Berechtigungs-Editor für Solo-Brautpaare — gleicher Editor wie im
// Veranstalter-Portal (schreibt dienstleister_permissions; RLS via
// Migration 0090 über is_event_member, matcht brautpaar_solo).
export default async function SoloDienstleisterBerechtigungenPage({ params }: Props) {
  const { eventId, dienstleisterId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'brautpaar_solo') redirect(`/brautpaar/${eventId}/uebersicht`)

  const { data: dlProfile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', dienstleisterId)
    .maybeSingle()

  if (!dlProfile) redirect(`/brautpaar/${eventId}/dienstleister`)

  const { data: dlMember } = await supabase
    .from('event_members')
    .select('id, role')
    .eq('event_id', eventId)
    .eq('user_id', dienstleisterId)
    .maybeSingle()

  if (!dlMember || dlMember.role !== 'dienstleister') redirect(`/brautpaar/${eventId}/dienstleister`)

  const { data: perms } = await supabase
    .from('dienstleister_permissions')
    .select('id, tab_key, item_id, access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', dienstleisterId)

  return (
    <div className="bp-page">
      <BerechtigungenDLClient
        eventId={eventId}
        dienstleisterId={dienstleisterId}
        dienstleisterName={dlProfile.name ?? 'Dienstleister'}
        dienstleisterEmail={dlProfile.email ?? ''}
        initialPerms={(perms ?? []) as DienstleisterPermRow[]}
        backHref={`/brautpaar/${eventId}/dienstleister`}
        backLabel="Zurück zu Dienstleister"
      />
    </div>
  )
}
