import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DienstleisterVorschlaegeClient from './DienstleisterVorschlaegeClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function DienstleisterVorschlaegePage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberCheck } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!memberCheck || memberCheck.role !== 'veranstalter') redirect(`/veranstalter/${eventId}/uebersicht`)

  return (
    <DienstleisterVorschlaegeClient
      eventId={eventId}
      userId={user.id}
    />
  )
}
