import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EinstellungenClient from './EinstellungenClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function EinstellungenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)) {
    redirect('/login')
  }

  // Gibt es einen Veranstalter im Event? Dann zahlt das Paar nicht selbst →
  // die Abo-Sektion wird ausgeblendet.
  const { data: organizers } = await supabase
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('role', 'veranstalter')

  const hasOrganizer = (organizers ?? []).length > 0

  return (
    <EinstellungenClient
      eventId={eventId}
      currentUserId={user.id}
      isSolo={member.role === 'brautpaar_solo'}
      hasOrganizer={hasOrganizer}
    />
  )
}
