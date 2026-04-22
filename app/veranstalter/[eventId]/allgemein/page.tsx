import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AllgemeinForm from './AllgemeinForm'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AllgemeinPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select(`
      id, title, couple_name, date, ceremony_start, description,
      venue, venue_address,
      location_name, location_street, location_zip, location_city, location_website,
      max_begleitpersonen, children_allowed, children_note,
      meal_options, menu_type, collect_allergies,
      budget_total, organizer_fee, organizer_fee_type,
      internal_notes, dresscode, projektphase
    `)
    .eq('id', eventId)
    .single()

  if (!event) redirect('/veranstalter')

  const [{ data: bpMembers }, { data: organizerCosts }] = await Promise.all([
    supabase
      .from('event_members')
      .select('id, user_id, profiles(id, name, email)')
      .eq('event_id', eventId)
      .eq('role', 'brautpaar'),
    supabase
      .from('event_organizer_costs')
      .select('id, category, amount, notes')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
  ])

  const bpNormalized = (bpMembers ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  return (
    <AllgemeinForm
      eventId={eventId}
      initialData={event}
      bpMembers={bpNormalized}
      initialCosts={organizerCosts ?? []}
    />
  )
}
