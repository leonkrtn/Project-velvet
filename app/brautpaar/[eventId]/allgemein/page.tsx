import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarAllgemein from './BrautpaarAllgemein'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AllgemeinPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select(`
      id, title, couple_name, date, ceremony_start, description,
      venue, venue_address,
      location_name, location_street, location_zip, location_city, location_website,
      max_begleitpersonen, children_allowed, children_note,
      meal_options, menu_type, collect_allergies,
      budget_total, dresscode
    `)
    .eq('id', eventId)
    .single()

  if (!event) redirect('/login')

  return (
    <BrautpaarAllgemein
      eventId={eventId}
      initialData={event}
    />
  )
}
