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

  const { data: { user } } = await supabase.auth.getUser()
  const { data: preset } = user
    ? await supabase.from('organizer_presets').select('location_name, location_street, location_zip, location_city, location_website').eq('user_id', user.id).single()
    : { data: null }

  if (preset) {
    if (!event.location_name)    event.location_name    = preset.location_name
    if (!event.location_street)  event.location_street  = preset.location_street
    if (!event.location_zip)     event.location_zip     = preset.location_zip
    if (!event.location_city)    event.location_city    = preset.location_city
    if (!event.location_website) event.location_website = preset.location_website
  }

  const [{ data: bpMembers }, { data: organizerCosts }, { data: toggleRows }] = await Promise.all([
    supabase
      .from('event_members')
      .select('id, user_id, profiles!user_id(id, name, email)')
      .eq('event_id', eventId)
      .eq('role', 'brautpaar'),
    supabase
      .from('event_organizer_costs')
      .select('id, category, amount, notes')
      .eq('event_id', eventId)
      .neq('source', 'catering')
      .order('created_at', { ascending: true }),
    supabase
      .from('feature_toggles')
      .select('key, enabled, value')
      .eq('event_id', eventId),
  ])

  const bpNormalized = (bpMembers ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  // Build toggle map with defaults
  const initialToggles: Record<string, boolean> = {
    'gaeste-fotos': true,
    'messaging': false,
    'bp-gaeste': true, 'bp-sitzplan': true, 'bp-ablaufplan': true,
    'bp-catering': true, 'bp-dekoration': true, 'bp-musik': true,
    'bp-patisserie': true, 'bp-medien': true, 'bp-budget': true,
    'bp-aufgaben': true, 'bp-nachrichten': true, 'bp-dateien': true,
    'rsvp-musikwunsch': true, 'rsvp-geschenke': true, 'rsvp-hotel': true,
    'rsvp-begleitpersonen': true, 'rsvp-menu': true,
  }
  let initialGalleryUnlockAt: string | null = null
  for (const row of toggleRows ?? []) {
    if (row.key === 'gaeste-fotos-unlock-at') {
      initialGalleryUnlockAt = (row as any).value ?? null
    } else {
      initialToggles[row.key] = row.enabled
    }
  }

  return (
    <AllgemeinForm
      eventId={eventId}
      initialData={event}
      bpMembers={bpNormalized}
      initialCosts={organizerCosts ?? []}
      initialToggles={initialToggles}
      initialGalleryUnlockAt={initialGalleryUnlockAt}
    />
  )
}
