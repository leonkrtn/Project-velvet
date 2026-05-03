import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GaestelisteClient from './GaestelisteClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function GaestelistePage({ params }: Props) {
  const { eventId } = await params
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

  const { data: guests } = await supabase
    .from('guests')
    .select('id, name, status, side, allergy_tags, allergy_custom, meal_choice')
    .eq('event_id', eventId)
    .order('name')

  const { data: event } = await supabase
    .from('events')
    .select('meal_options')
    .eq('id', eventId)
    .single()

  return (
    <GaestelisteClient
      eventId={eventId}
      initialGuests={guests ?? []}
      mealOptions={event?.meal_options ?? []}
    />
  )
}
